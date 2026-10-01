-- Admin Traffic: accurate, filterable analytics (see the Traffic audit).
--
-- request_logs.traffic_class   who sent it - 'human', 'crawler' (search
--                              engines, link previews, AI crawlers),
--                              'monitor' (uptime checks) or 'bot' - from the
--                              user agent. Set by app/api/internal/edge-log
--                              (lib/traffic-class.js); older rows backfilled
--                              here with classify_user_agent(), which uses
--                              the same patterns.
-- admin_traffic_rows()         the request log for a time window and the
--                              Traffic page's filters (country, IP, method,
--                              path, user agent, referrer, outcome, flagged,
--                              audience). Every aggregate below reads through
--                              it, so the totals, map, timeline, top IPs and
--                              breakdowns always cover the whole range and
--                              the same filters as the log.
-- admin_traffic_top()          whole-range breakdowns (paths, referrers,
--                              user agents, countries, API endpoints, 404s,
--                              server errors, client types) - they used to be
--                              counted from the newest 5,000 rows only.
-- traffic_alerts               spike / flood alerts raised by
--                              lib/traffic-alerts.js, shown on Traffic
-- traffic_alert_state          when traffic was last checked, and the last
--                              alert of each kind (so one per hour per kind)
-- prune_request_logs()         deletes log lines older than the retention the
--                              admin sets (app/api/cron/admin-daily), in
--                              batches
--
-- Also drops idx_request_logs_ts, an exact duplicate of request_logs_ts_idx.
-- All functions are service-role only.

drop index if exists public.idx_request_logs_ts;

create or replace function public.classify_user_agent(p_ua text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(btrim(p_ua), '') = '' then 'bot'
    when p_ua ~* 'sentryuptimebot|uptimerobot|pingdom|statuscake|site24x7|better ?uptime|betterstack|checkly|datadog(?:synthetics| synthetic)|newrelicpinger|freshping|hetrixtools|uptime-kuma|vercel-(?:screenshot|healthcheck)' then 'monitor'
    when p_ua ~* 'googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|baiduspider|yandex(?:bot|images)|applebot|slurp|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|seznambot|facebookexternalhit|facebookcatalog|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterestbot|redditbot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|ccbot|perplexitybot|bytespider|amazonbot|dataprovider|chrome privacy preserving prefetch proxy' then 'crawler'
    when p_ua ~* '(^|[^a-z])bot([^a-z]|$)|[a-z0-9]bot/|bot[;)]|crawl|spider|scan|curl/|wget|python|go-http-client|java/|okhttp|apache-httpclient|httpclient|axios|node-fetch|undici|headless|phantomjs|libwww|zgrab|nmap|masscan|nikto|sqlmap|scrapy|postmanruntime|insomnia|httpie|aiohttp|guzzlehttp|ruby|perl' then 'bot'
    else 'human'
  end;
$$;

alter table public.request_logs
  add column if not exists traffic_class text check (traffic_class is null or traffic_class in ('human', 'crawler', 'monitor', 'bot'));

update public.request_logs set traffic_class = public.classify_user_agent(user_agent) where traffic_class is null;

-- Any insert that doesn't say (an older deploy of the logger, a manual
-- insert) is classified on the way in.
create or replace function public.request_logs_set_class()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.traffic_class is null then
    new.traffic_class := public.classify_user_agent(new.user_agent);
  end if;
  return new;
end;
$$;

create or replace trigger request_logs_set_class
  before insert on public.request_logs
  for each row execute function public.request_logs_set_class();

create index if not exists request_logs_class_ts_idx on public.request_logs (traffic_class, ts desc);
create index if not exists request_logs_status_ts_idx on public.request_logs (ts desc) where status_code >= 400;

-- p_filters: { country, ip, method, path, ua, referrer, outcome,
-- flagged: bool, audience: 'all' | 'people' | 'automated' | 'crawler' |
-- 'monitor' | 'bot' }. Text filters are substring matches with LIKE
-- wildcards escaped; 'people' also leaves out the admin area.
create or replace function public.admin_traffic_rows(p_since timestamptz, p_until timestamptz, p_filters jsonb default '{}'::jsonb)
returns setof public.request_logs
language sql
stable
security invoker
set search_path = public
as $$
  select r.*
  from public.request_logs r
  where r.ts >= p_since
    and (p_until is null or r.ts < p_until)
    and (nullif(p_filters->>'country', '') is null or r.country = upper(p_filters->>'country'))
    and (nullif(p_filters->>'ip', '') is null or r.ip = p_filters->>'ip')
    and (nullif(p_filters->>'method', '') is null or r.method = upper(p_filters->>'method'))
    and (nullif(p_filters->>'path', '') is null
         or r.path ilike '%' || replace(replace(replace(p_filters->>'path', '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (nullif(p_filters->>'ua', '') is null
         or r.user_agent ilike '%' || replace(replace(replace(p_filters->>'ua', '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (nullif(p_filters->>'referrer', '') is null
         or r.referer ilike '%' || replace(replace(replace(p_filters->>'referrer', '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (case p_filters->>'outcome'
           when 'blocked' then r.blocked
           when 'allowed' then (r.outcome = 'allowed' or (r.outcome is null and not r.blocked))
           when 'redirected' then r.outcome = 'redirected'
           when 'not_found' then r.outcome = 'not_found'
           else true
         end)
    and (coalesce((p_filters->>'flagged')::boolean, false) = false or coalesce(r.threat_score, 0) >= 20)
    and (case coalesce(p_filters->>'audience', 'all')
           when 'people' then coalesce(r.traffic_class, 'human') = 'human'
                              and r.path not like '/admin%' and r.path not like '/api/admin/%'
           when 'automated' then coalesce(r.traffic_class, 'human') <> 'human'
           when 'crawler' then r.traffic_class = 'crawler'
           when 'monitor' then r.traffic_class = 'monitor'
           when 'bot' then r.traffic_class = 'bot'
           else true
         end);
$$;

create or replace function public.admin_traffic_summary_f(p_since timestamptz, p_until timestamptz, p_filters jsonb default '{}'::jsonb)
returns table (
  requests bigint,
  blocked bigint,
  flagged bigint,
  unique_ips bigint,
  visitors bigint,
  geolocated bigint,
  countries bigint,
  people bigint,
  crawlers bigint,
  monitors bigint,
  bots bigint,
  not_found bigint,
  server_errors bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where r.blocked),
    count(*) filter (where coalesce(r.threat_score, 0) >= 20),
    count(distinct r.ip),
    -- An approximation of people: a browser on an address.
    count(distinct (r.ip, r.user_agent)) filter (where coalesce(r.traffic_class, 'human') = 'human' and r.path not like '/admin%' and r.path not like '/api/admin/%'),
    count(*) filter (where r.lat is not null and r.lon is not null),
    count(distinct r.country),
    count(*) filter (where coalesce(r.traffic_class, 'human') = 'human'),
    count(*) filter (where r.traffic_class = 'crawler'),
    count(*) filter (where r.traffic_class = 'monitor'),
    count(*) filter (where r.traffic_class = 'bot'),
    count(*) filter (where r.status_code = 404 and coalesce(r.outcome, 'allowed') = 'allowed'),
    count(*) filter (where r.status_code >= 500)
  from public.admin_traffic_rows(p_since, p_until, p_filters) r;
$$;

create or replace function public.admin_traffic_geo_f(p_since timestamptz, p_until timestamptz, p_filters jsonb default '{}'::jsonb)
returns table (country text, city text, lat double precision, lon double precision, requests bigint, blocked bigint, unique_ips bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.country,
    r.city,
    round(r.lat::numeric, 1)::double precision,
    round(r.lon::numeric, 1)::double precision,
    count(*) as requests,
    count(*) filter (where r.blocked),
    count(distinct r.ip)
  from public.admin_traffic_rows(p_since, p_until, p_filters) r
  where r.lat is not null and r.lon is not null
  group by 1, 2, 3, 4
  order by requests desc
  limit 400;
$$;

create or replace function public.admin_traffic_timeline_f(p_since timestamptz, p_until timestamptz, p_filters jsonb default '{}'::jsonb, p_bucket text default 'hour')
returns table (bucket timestamptz, requests bigint, blocked bigint, flagged bigint, people bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc(case when p_bucket = 'day' then 'day' else 'hour' end, r.ts) as bucket,
    count(*),
    count(*) filter (where r.blocked),
    count(*) filter (where coalesce(r.threat_score, 0) >= 20),
    count(*) filter (where coalesce(r.traffic_class, 'human') = 'human' and r.path not like '/admin%' and r.path not like '/api/admin/%')
  from public.admin_traffic_rows(p_since, p_until, p_filters) r
  group by 1
  order by 1;
$$;

create or replace function public.admin_top_ips_f(p_since timestamptz, p_until timestamptz, p_filters jsonb default '{}'::jsonb, p_limit integer default 25)
returns table (ip text, requests bigint, blocked bigint, max_threat integer, countries text[], classes text[], first_seen timestamptz, last_seen timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.ip,
    count(*) as requests,
    count(*) filter (where r.blocked),
    max(coalesce(r.threat_score, 0))::integer,
    (array_agg(distinct r.country) filter (where r.country is not null))[1:5],
    array_agg(distinct coalesce(r.traffic_class, 'human')),
    min(r.ts),
    max(r.ts)
  from public.admin_traffic_rows(p_since, p_until, p_filters) r
  where r.ip is not null
  group by r.ip
  order by count(*) desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- p_dimension: path, referrer (by site), user_agent, country, class, method,
-- api (/api/* paths), not_found (paths answered 404), server_error (paths
-- that failed with 5xx).
create or replace function public.admin_traffic_top(p_since timestamptz, p_until timestamptz, p_filters jsonb, p_dimension text, p_limit integer default 10)
returns table (name text, requests bigint, blocked bigint, errors bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    case p_dimension
      when 'path' then coalesce(r.path, '(unknown)')
      when 'api' then r.path
      when 'not_found' then r.path
      when 'server_error' then r.path
      when 'referrer' then coalesce(nullif(lower(split_part(split_part(r.referer, '://', 2), '/', 1)), ''), '(direct)')
      when 'user_agent' then coalesce(nullif(r.user_agent, ''), '(none)')
      when 'country' then coalesce(r.country, '(unknown)')
      when 'class' then coalesce(r.traffic_class, 'human')
      when 'method' then coalesce(r.method, 'GET')
    end as name,
    count(*) as requests,
    count(*) filter (where r.blocked),
    count(*) filter (where r.status_code >= 400 and coalesce(r.outcome, 'allowed') = 'allowed')
  from public.admin_traffic_rows(p_since, p_until, p_filters) r
  where case p_dimension
          when 'api' then r.path like '/api/%'
          when 'not_found' then r.status_code = 404 and coalesce(r.outcome, 'allowed') = 'allowed'
          when 'server_error' then r.status_code >= 500
          else true
        end
  group by 1
  order by requests desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- What the spike check compares: the last window against the average
-- window over the previous seven days (uptime monitors left out).
create or replace function public.admin_traffic_spike_stats(p_window_minutes integer default 15)
returns table (
  recent_requests bigint,
  recent_blocked bigint,
  recent_errors bigint,
  baseline_requests numeric,
  baseline_blocked numeric,
  top_ip text,
  top_ip_requests bigint,
  top_country text,
  top_country_requests bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with w as (select make_interval(mins => greatest(p_window_minutes, 5)) as span),
  recent as (
    select r.* from public.request_logs r, w
    where r.ts >= now() - w.span and coalesce(r.traffic_class, 'human') <> 'monitor'
  ),
  base as (
    select
      count(*)::numeric / greatest(1, (extract(epoch from interval '7 days') / extract(epoch from w.span)))::numeric as req,
      (count(*) filter (where r.blocked))::numeric / greatest(1, (extract(epoch from interval '7 days') / extract(epoch from w.span)))::numeric as blk
    from public.request_logs r, w
    where r.ts >= now() - interval '7 days' - w.span and r.ts < now() - w.span
      and coalesce(r.traffic_class, 'human') <> 'monitor'
    group by w.span
  ),
  ip as (select r.ip, count(*) c from recent r where r.ip is not null group by 1 order by 2 desc limit 1),
  ctry as (select r.country, count(*) c from recent r where r.country is not null group by 1 order by 2 desc limit 1)
  select
    (select count(*) from recent),
    (select count(*) from recent where blocked),
    (select count(*) from recent where status_code >= 500),
    coalesce((select req from base), 0),
    coalesce((select blk from base), 0),
    (select ip from ip),
    coalesce((select c from ip), 0),
    (select country from ctry),
    coalesce((select c from ctry), 0);
$$;

create table if not exists public.traffic_alerts (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('surge', 'blocked_surge', 'errors', 'ip_flood')),
  message     text not null check (char_length(message) <= 500),
  details     jsonb not null default '{}'::jsonb,
  emailed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists traffic_alerts_created_idx on public.traffic_alerts (created_at desc);

create table if not exists public.traffic_alert_state (
  key              text primary key,
  last_checked_at  timestamptz not null default now(),
  last_alerts      jsonb not null default '{}'::jsonb
);

-- True for exactly one caller per p_every_seconds, however many servers
-- are logging requests at once.
create or replace function public.claim_traffic_check(p_every_seconds integer default 300)
returns boolean
language sql
volatile
security invoker
set search_path = public
as $$
  with claimed as (
    insert into public.traffic_alert_state as s (key, last_checked_at)
    values ('spike', now())
    on conflict (key) do update set last_checked_at = now()
      where s.last_checked_at < now() - make_interval(secs => greatest(p_every_seconds, 30))
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Deletes up to p_batch log lines older than p_before; returns how many.
create or replace function public.prune_request_logs(p_before timestamptz, p_batch integer default 5000)
returns integer
language sql
volatile
security invoker
set search_path = public
as $$
  with doomed as (
    select id from public.request_logs where ts < p_before order by ts limit least(greatest(p_batch, 1), 20000)
  ),
  gone as (
    delete from public.request_logs r using doomed d where r.id = d.id returning 1
  )
  select count(*)::integer from gone;
$$;

alter table public.traffic_alerts enable row level security;
alter table public.traffic_alert_state enable row level security;
comment on table public.traffic_alerts is 'Service-role only. Raised by lib/traffic-alerts.js, listed on admin Traffic.';
comment on table public.traffic_alert_state is 'Service-role only. Throttles the traffic spike check.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.classify_user_agent(text)',
    'public.request_logs_set_class()',
    'public.admin_traffic_rows(timestamptz, timestamptz, jsonb)',
    'public.admin_traffic_summary_f(timestamptz, timestamptz, jsonb)',
    'public.admin_traffic_geo_f(timestamptz, timestamptz, jsonb)',
    'public.admin_traffic_timeline_f(timestamptz, timestamptz, jsonb, text)',
    'public.admin_top_ips_f(timestamptz, timestamptz, jsonb, integer)',
    'public.admin_traffic_top(timestamptz, timestamptz, jsonb, text, integer)',
    'public.admin_traffic_spike_stats(integer)',
    'public.claim_traffic_check(integer)',
    'public.prune_request_logs(timestamptz, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
