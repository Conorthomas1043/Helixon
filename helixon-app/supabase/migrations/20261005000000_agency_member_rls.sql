-- Database-level tenant isolation (defence in depth).
--
-- Until now one agency's data was kept from another's only by the API code:
-- every server query runs with the service-role key, which bypasses RLS, and
-- carries `.eq("agency_id", ...)`. One forgotten filter would leak data.
--
-- This adds a second, independent check in the database. Customer API routes
-- query agency tables through lib/agency-db.js, which (once switched on with
-- SUPABASE_AGENCY_RLS=1) uses a short-lived JWT the *server* signs for the
-- `agency_member` role, carrying the member's agency_id. The policies below
-- then only ever show or accept that agency's rows, whatever the query says.
--
-- Why a dedicated role rather than Clerk tokens + `authenticated`: a signed-in
-- user can obtain their own Clerk token in the browser, so any policy granted
-- to `authenticated` could be used straight against the Supabase REST API,
-- skipping the app's permission rules and audit log. That is the hole closed
-- by 20260916161700_lock_down_agency_scoped_tables_post_clerk_migration. Only
-- the server holds the signing secret, so only the server can act as
-- agency_member; `anon` and `authenticated` still get nothing.
--
-- Safe to apply before the switch is on: the service-role key is unaffected.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agency_member') then
    create role agency_member nologin noinherit;
  end if;
end
$$;

-- PostgREST connects as `authenticator` and switches to the JWT's role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant agency_member to authenticator;
  end if;
end
$$;

grant usage on schema public to agency_member;

-- The agency this request acts for: the server-signed `agency_id` claim.
create or replace function public.request_agency_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'agency_id', '')::uuid
$$;

revoke execute on function public.request_agency_id() from public, anon, authenticated;
-- service_role too: it is the column default below, evaluated on its inserts
-- (where it is null, so those inserts behave exactly as before).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.request_agency_id() to service_role;
  end if;
end
$$;
grant execute on function public.request_agency_id() to agency_member;

-- Every table with an agency_id column, except those that stay service-role
-- only: identity and secrets (profiles, api_keys, webhook_endpoints,
-- integration_connections, member_tokens), the tamper-evident audit log, and
-- research data. lib/agency-db.js's AGENCY_RLS_EXCLUDED must list the same.
-- Re-run this block (or this migration) after adding a new agency table.
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'agency_id'
      and tb.table_type = 'BASE TABLE'
      and c.table_name not in (
        'profiles', 'api_keys', 'webhook_endpoints', 'integration_connections',
        'member_tokens', 'agency_audit_log', 'research_signals'
      )
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists agency_member_own_rows on public.%I', t);
    execute format(
      'create policy agency_member_own_rows on public.%I for all to agency_member '
      'using (agency_id = (select public.request_agency_id())) '
      'with check (agency_id = (select public.request_agency_id()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to agency_member', t);
    -- An insert that doesn't name the agency gets the token's, instead of a
    -- null the policy would refuse. Existing defaults are left alone.
    if (select column_default from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'agency_id') is null then
      execute format('alter table public.%I alter column agency_id set default public.request_agency_id()', t);
    end if;
  end loop;
end
$$;

grant usage on all sequences in schema public to agency_member;

-- Run before switching SUPABASE_AGENCY_RLS on: rows with no agency_id are
-- invisible to agency_member, so every count here must be 0 first.
--   select * from public.agency_rls_readiness() where rows_without_agency > 0;
create or replace function public.agency_rls_readiness()
returns table (table_name text, rows_without_agency bigint)
language plpgsql
set search_path = ''
as $$
declare
  t text;
begin
  for t in
    select distinct p.tablename from pg_policies p
    where p.schemaname = 'public' and p.policyname = 'agency_member_own_rows'
    order by 1
  loop
    table_name := t;
    execute format('select count(*) from public.%I where agency_id is null', t) into rows_without_agency;
    return next;
  end loop;
end
$$;

revoke execute on function public.agency_rls_readiness() from public, anon, authenticated;
