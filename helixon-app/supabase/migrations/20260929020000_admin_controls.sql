-- Admin console controls: per-employee permissions, admin access to the
-- employee portal, site-wide settings, and full-range traffic aggregates
-- for the traffic map. Additive only - nothing existing is dropped or
-- rewritten.

-- ── Employees ────────────────────────────────────────────────────────────
-- Which portal sections an employee can use. NULL means "whatever their
-- role allows" (lib/employee-permissions.js holds the role presets); an
-- object overrides individual sections with "none", "view" or "edit",
-- e.g. {"cold_calls": "none", "files": "view"}.
alter table public.employees
  add column if not exists permissions jsonb;

alter table public.employees drop constraint if exists employees_permissions_is_object;
alter table public.employees
  add constraint employees_permissions_is_object
  check (permissions is null or jsonb_typeof(permissions) = 'object');

-- Set on the staff account an admin uses when they open the employee
-- portal from the admin console, so each admin gets one stable portal
-- identity instead of a new row per visit.
alter table public.employees
  add column if not exists admin_username text;

create unique index if not exists employees_admin_username_key
  on public.employees (admin_username)
  where admin_username is not null;

-- When an admin opens the portal as a particular employee, the session
-- records which admin it was, so the portal can show a banner and the
-- audit trail can tell the two apart.
alter table public.employee_sessions
  add column if not exists impersonated_by text;

create index if not exists employee_sessions_employee_id_idx
  on public.employee_sessions (employee_id);

-- ── Site settings ────────────────────────────────────────────────────────
-- Key/value switches managed from the admin console's Site controls page
-- (maintenance mode, announcement banner, feature switches). Read by the
-- app through lib/site-settings.js; written only by admin API routes.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.site_settings enable row level security;

comment on table public.site_settings is
  'Site-wide switches set from the admin console (Site controls). Service-role only - no anon/authenticated policies are defined intentionally.';

-- ── Traffic aggregates ───────────────────────────────────────────────────
-- The traffic API used to pull the newest 5,000 request_logs rows and
-- aggregate them in JavaScript, so for 7d/30d ranges (tens of thousands of
-- rows) the map and totals only reflected the last couple of days. These
-- aggregate the whole range in the database instead.

-- One row per place (coordinates rounded to ~11 km so a city's handful of
-- slightly different coordinates collapse into one point).
create or replace function public.admin_traffic_geo(p_since timestamptz)
returns table (
  country text,
  city text,
  lat double precision,
  lon double precision,
  requests bigint,
  blocked bigint,
  unique_ips bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.country,
    r.city,
    round(r.lat::numeric, 1)::double precision as lat,
    round(r.lon::numeric, 1)::double precision as lon,
    count(*) as requests,
    count(*) filter (where r.blocked) as blocked,
    count(distinct r.ip) as unique_ips
  from public.request_logs r
  where r.ts >= p_since
    and r.lat is not null
    and r.lon is not null
  group by 1, 2, 3, 4
  order by requests desc
  limit 400;
$$;

create or replace function public.admin_traffic_summary(p_since timestamptz)
returns table (
  requests bigint,
  blocked bigint,
  unique_ips bigint,
  geolocated bigint,
  countries bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) as requests,
    count(*) filter (where r.blocked) as blocked,
    count(distinct r.ip) as unique_ips,
    count(*) filter (where r.lat is not null and r.lon is not null) as geolocated,
    count(distinct r.country) as countries
  from public.request_logs r
  where r.ts >= p_since;
$$;

revoke execute on function public.admin_traffic_geo(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_traffic_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_traffic_geo(timestamptz) to service_role;
grant execute on function public.admin_traffic_summary(timestamptz) to service_role;
