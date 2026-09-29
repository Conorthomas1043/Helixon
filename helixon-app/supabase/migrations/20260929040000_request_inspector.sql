-- Request inspector and IP enumeration for Admin > Traffic / Investigate.
-- Additive only.

-- ── Request detail ───────────────────────────────────────────────────────
-- Captured by proxy.ts -> /api/internal/edge-log. Headers and query strings
-- are stored with secrets redacted (lib/request-capture.js); request bodies
-- are only ever kept for requests the firewall blocked. The daily admin
-- cron clears headers (and, for unflagged requests, query and payload)
-- after the retention period set on the Traffic page.
alter table public.request_logs
  add column if not exists uid uuid,
  add column if not exists host text,
  add column if not exists protocol text,
  add column if not exists query text,
  add column if not exists headers jsonb,
  add column if not exists payload text,
  add column if not exists outcome text,      -- allowed | blocked | redirected | not_found
  add column if not exists status_code smallint,
  add column if not exists location text,     -- where a redirect sent them
  add column if not exists rule text,         -- what decided: allow_list, country, ip_range, path, user_agent, ip_block, firewall, maintenance, sign_in, admin
  add column if not exists threat_score smallint,
  add column if not exists signals text[],
  add column if not exists region text,
  add column if not exists postal text,
  add column if not exists timezone text,
  add column if not exists edge_id text;      -- Vercel's x-vercel-id, to find the request in Vercel's logs

create unique index if not exists request_logs_uid_key on public.request_logs (uid) where uid is not null;
create index if not exists request_logs_ip_ts_idx on public.request_logs (ip, ts desc);

-- ── IP enumeration cache ─────────────────────────────────────────────────
-- Results of the passive lookups (reverse DNS, ASN, RDAP, Tor) per IP, so
-- a dossier doesn't hit the registries on every view.
create table if not exists public.ip_intel (
  ip text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.ip_intel enable row level security;
comment on table public.ip_intel is
  'Cached passive IP lookups for the admin IP dossier. Service-role only.';

-- ── Firewall: block an IP range ──────────────────────────────────────────
alter table public.firewall_rules drop constraint if exists firewall_rules_kind_check;
alter table public.firewall_rules
  add constraint firewall_rules_kind_check
  check (kind in ('allow_ip', 'block_country', 'block_path', 'block_ua', 'block_cidr'));

-- ── Helpers and aggregates ───────────────────────────────────────────────
-- request_logs.ip is text (it can be "unknown"); this casts without failing.
create or replace function public.try_inet(p text)
returns inet
language plpgsql
immutable
set search_path = public
as $$
begin
  return p::inet;
exception when others then
  return null;
end;
$$;

-- Requests per hour (or day) with how many were blocked or flagged.
create or replace function public.admin_traffic_timeline(p_since timestamptz, p_bucket text default 'hour')
returns table (bucket timestamptz, requests bigint, blocked bigint, flagged bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc(case when p_bucket = 'day' then 'day' else 'hour' end, r.ts) as bucket,
    count(*) as requests,
    count(*) filter (where r.blocked) as blocked,
    count(*) filter (where coalesce(r.threat_score, 0) >= 20) as flagged
  from public.request_logs r
  where r.ts >= p_since
  group by 1
  order by 1;
$$;

-- The busiest IPs in a window.
create or replace function public.admin_top_ips(p_since timestamptz, p_limit integer default 25)
returns table (ip text, requests bigint, blocked bigint, max_threat integer, countries text[], first_seen timestamptz, last_seen timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.ip,
    count(*) as requests,
    count(*) filter (where r.blocked) as blocked,
    max(coalesce(r.threat_score, 0))::integer as max_threat,
    (array_agg(distinct r.country) filter (where r.country is not null))[1:5] as countries,
    min(r.ts) as first_seen,
    max(r.ts) as last_seen
  from public.request_logs r
  where r.ts >= p_since and r.ip is not null
  group by r.ip
  order by count(*) desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Everything logged about one IP, summarised.
create or replace function public.admin_ip_activity(p_ip text)
returns table (requests bigint, blocked bigint, first_seen timestamptz, last_seen timestamptz, max_threat integer, countries text[], user_agents bigint, paths bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where r.blocked),
    min(r.ts),
    max(r.ts),
    max(coalesce(r.threat_score, 0))::integer,
    array_agg(distinct r.country) filter (where r.country is not null),
    count(distinct r.user_agent),
    count(distinct r.path)
  from public.request_logs r
  where r.ip = p_ip;
$$;

-- Other IPs from the same network range (e.g. the /24) - to spot a scan
-- spread across neighbouring addresses.
create or replace function public.admin_ip_neighbours(p_cidr cidr, p_since timestamptz)
returns table (ip text, requests bigint, blocked bigint, last_seen timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select r.ip, count(*), count(*) filter (where r.blocked), max(r.ts)
  from public.request_logs r
  where r.ts >= p_since
    and public.try_inet(r.ip) <<= p_cidr
  group by r.ip
  order by count(*) desc
  limit 50;
$$;

revoke execute on function public.try_inet(text) from public, anon, authenticated;
revoke execute on function public.admin_traffic_timeline(timestamptz, text) from public, anon, authenticated;
revoke execute on function public.admin_top_ips(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.admin_ip_activity(text) from public, anon, authenticated;
revoke execute on function public.admin_ip_neighbours(cidr, timestamptz) from public, anon, authenticated;
grant execute on function public.try_inet(text) to service_role;
grant execute on function public.admin_traffic_timeline(timestamptz, text) to service_role;
grant execute on function public.admin_top_ips(timestamptz, integer) to service_role;
grant execute on function public.admin_ip_activity(text) to service_role;
grant execute on function public.admin_ip_neighbours(cidr, timestamptz) to service_role;
