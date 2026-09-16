-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default on function
-- creation, and anon/authenticated both implicitly inherit PUBLIC grants -
-- Supabase's project setup also grants EXECUTE to anon/authenticated
-- explicitly per-function. Revoking only "from anon, authenticated" in the
-- previous migration (current_agency_id) worked because that function had
-- no separate PUBLIC grant; handle_new_user() had both, so it stayed
-- callable via POST /rest/v1/rpc/handle_new_user until all three grants
-- (anon, authenticated, public) are revoked explicitly.
revoke execute on function public.current_agency_id() from public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
