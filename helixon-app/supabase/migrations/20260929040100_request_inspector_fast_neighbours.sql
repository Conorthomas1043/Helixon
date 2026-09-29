-- The IP dossier's "same network" lookup took over a second: try_inet()
-- caught cast errors with a plpgsql exception block, which opens a
-- subtransaction for every row it touches (a month of request_logs).
-- pg_input_is_valid() (Postgres 16+) checks the text without raising, so
-- the cast can be guarded inline instead - about 13x faster.

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
    and (case when pg_input_is_valid(r.ip, 'inet') then r.ip::inet end) <<= p_cidr
  group by r.ip
  order by count(*) desc
  limit 50;
$$;

-- Nothing else used it.
drop function if exists public.try_inet(text);

revoke execute on function public.admin_ip_neighbours(cidr, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ip_neighbours(cidr, timestamptz) to service_role;
