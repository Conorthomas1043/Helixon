-- SECURITY FIX
--
-- current_agency_id() resolves agency_id via `recruiters.agency_id where
-- recruiters.id = auth.uid()`. recruiters.agency_id is populated by the
-- handle_new_user() trigger straight from auth.users' raw_user_meta_data,
-- which is caller-supplied at Supabase Auth signup time (POST
-- /auth/v1/signup with the public anon key, independent of anything this
-- app's own UI does). Combined with the RLS policies below that trusted
-- current_agency_id(), anyone could:
--   1. sign up directly against Supabase Auth with metadata
--      {"agency_id": "<any target agency's uuid>"}
--   2. sign back in to get a valid auth.uid()
--   3. current_agency_id() now resolves to the stolen agency_id
--   4. the "manage own candidates"/"manage own jobs"/etc policies below
--      then granted full read/write on that agency's real candidate and
--      job data via Supabase's public REST API.
--
-- None of this is used by the live app - identity is Clerk-based now
-- (see lib/customer-auth.js), every real request goes through the
-- Next.js API layer using the Supabase service-role key (which bypasses
-- RLS entirely), and agency scoping is enforced there via
-- requireCustomerContext(). These policies were dead weight for the app
-- and a live hole for anyone hitting Supabase directly. Dropping them
-- leaves RLS enabled with zero policies on these tables, which is
-- default-deny for the anon/authenticated roles and has no effect on the
-- service-role key - the same intentional pattern already documented on
-- admins/request_logs/blocked_ips/todo_lists/shared_todos.

drop policy if exists "read own agency" on public.agencies;
drop policy if exists "manage own candidates" on public.candidates;
drop policy if exists "Users insert own candidates" on public.candidates;
drop policy if exists "Users see own candidates" on public.candidates;
drop policy if exists "manage own jobs" on public.jobs;
drop policy if exists "Users insert own jobs" on public.jobs;
drop policy if exists "Users see own jobs" on public.jobs;
drop policy if exists "read agency teammates" on public.recruiters;
drop policy if exists "insert activity on own candidates" on public.candidate_activity;
drop policy if exists "read activity on own candidates" on public.candidate_activity;
drop policy if exists "insert notes on own candidates" on public.candidate_notes;
drop policy if exists "read notes on own candidates" on public.candidate_notes;
drop policy if exists "Users insert own scores" on public.scores;
drop policy if exists "Users see own scores" on public.scores;
drop policy if exists "Users see own subscription" on public.subscriptions;
drop policy if exists "Users see their own subscription" on public.subscriptions;

-- Close the direct RPC path too (GET/POST /rest/v1/rpc/current_agency_id
-- was callable by anon/authenticated per the advisor scan) - nothing
-- legitimate calls it anymore now that no policy references it.
revoke execute on function public.current_agency_id() from anon, authenticated;

comment on table public.agencies is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/customer-auth.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old current_agency_id()-based policies were removed.';
comment on table public.candidates is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/customer-auth.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old current_agency_id()-based policies were removed.';
comment on table public.jobs is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/customer-auth.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old current_agency_id()-based policies were removed.';
comment on table public.scores is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/customer-auth.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old auth.uid()-based policies were removed.';
comment on table public.subscriptions is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/customer-auth.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old auth.uid()-based policies were removed.';
comment on table public.candidate_notes is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (app/api/candidates/[id]/notes), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration.';
comment on table public.candidate_activity is 'Service-role only. Clerk + agency_id auth enforced in the Next.js API layer (lib/candidate-activity.js), not RLS - see migration lock_down_agency_scoped_tables_post_clerk_migration.';
comment on table public.recruiters is 'Legacy pre-Clerk table, not written to by the live app (see lib/recruiter-directory.js for the real Clerk-based team lookup). Service-role only - see migration lock_down_agency_scoped_tables_post_clerk_migration for why the old read policy was removed.';
comment on function public.current_agency_id() is 'Legacy, resolves via auth.uid()/recruiters - always null for Clerk-authenticated requests. EXECUTE revoked from anon/authenticated per lock_down_agency_scoped_tables_post_clerk_migration; no RLS policy references it anymore.';
