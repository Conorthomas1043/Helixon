-- Granular admin controls, round two: time-limited IP blocks, an allow
-- list and country blocks, a leads pipeline, agency suspension and a
-- monthly screening cap, health-check history, dismissed threat findings,
-- and database-side counts for the Agencies page. Additive only.

-- ── Firewall ─────────────────────────────────────────────────────────────
-- NULL = permanent (the existing behaviour for every current row).
alter table public.blocked_ips
  add column if not exists expires_at timestamptz;

-- Rules managed from the admin Security page:
--   allow_ip       never blocked or scored (an office, a monitoring service)
--   block_country  every request from that ISO country code is refused
create table if not exists public.firewall_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('allow_ip', 'block_country')),
  value text not null check (char_length(value) between 2 and 64),
  note text check (note is null or char_length(note) <= 200),
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.firewall_rules enable row level security;
comment on table public.firewall_rules is
  'Admin-managed allow list and country blocks, read by /api/internal/edge-log. Service-role only - no client policies intentionally.';

-- Findings an admin has looked at and decided aren't a threat (a pentest
-- they ran, a monitoring bot). Hidden from Pentester until new activity.
create table if not exists public.threat_dismissals (
  ip text primary key,
  reason text check (reason is null or char_length(reason) <= 200),
  dismissed_by text,
  dismissed_at timestamptz not null default now()
);

alter table public.threat_dismissals enable row level security;
comment on table public.threat_dismissals is
  'IPs whose Pentester findings an admin dismissed. Service-role only.';

-- ── Leads ────────────────────────────────────────────────────────────────
alter table public.demo_requests
  add column if not exists status text not null default 'new',
  add column if not exists owner text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz,
  add column if not exists contacted_at timestamptz;

alter table public.demo_requests drop constraint if exists demo_requests_status_check;
alter table public.demo_requests
  add constraint demo_requests_status_check
  check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'spam'));

alter table public.demo_requests drop constraint if exists demo_requests_notes_length;
alter table public.demo_requests
  add constraint demo_requests_notes_length check (notes is null or char_length(notes) <= 4000);

-- ── Agencies ─────────────────────────────────────────────────────────────
-- suspended_at: set by an admin; the workspace's members get a 403 on
-- every agency-scoped API until it's cleared.
-- screening_cap: optional monthly limit on CV screenings (NULL = no cap).
-- The older analyses_limit/analyses_used columns were never enforced or
-- counted, so they're left alone rather than suddenly switched on.
alter table public.agencies
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists screening_cap integer;

alter table public.agencies drop constraint if exists agencies_screening_cap_positive;
alter table public.agencies
  add constraint agencies_screening_cap_positive check (screening_cap is null or screening_cap > 0);

-- One row per agency with the counts the Agencies page shows, computed in
-- the database instead of pulling capped row sets into JavaScript.
create or replace function public.admin_agency_counts()
returns table (
  agency_id uuid,
  members bigint,
  candidates bigint,
  candidates_month bigint,
  jobs bigint,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    (select count(*) from public.profiles p where p.agency_id = a.id),
    (select count(*) from public.candidates c where c.agency_id = a.id),
    (select count(*) from public.candidates c where c.agency_id = a.id and c.created_at >= date_trunc('month', now())),
    (select count(*) from public.jobs j where j.agency_id = a.id),
    greatest(
      (select max(c.created_at) from public.candidates c where c.agency_id = a.id),
      (select max(j.created_at) from public.jobs j where j.agency_id = a.id)
    )
  from public.agencies a;
$$;

revoke execute on function public.admin_agency_counts() from public, anon, authenticated;
grant execute on function public.admin_agency_counts() to service_role;

-- ── Health history ───────────────────────────────────────────────────────
create table if not exists public.admin_health_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  overall text not null,
  failing text[] not null default '{}',
  checked_by text
);

create index if not exists admin_health_snapshots_created_at_idx
  on public.admin_health_snapshots (created_at desc);

alter table public.admin_health_snapshots enable row level security;
comment on table public.admin_health_snapshots is
  'One row each time an admin runs the health checks, for the history strip on /admin/health. Service-role only.';

-- ── Audit log ────────────────────────────────────────────────────────────
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_target_id_idx
  on public.admin_audit_logs (target_id);
create index if not exists admin_audit_logs_target_ref_idx
  on public.admin_audit_logs ((metadata ->> 'targetRef'));
