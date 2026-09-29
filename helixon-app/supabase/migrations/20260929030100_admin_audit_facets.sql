-- Complete filter lists for the admin Audit log page. The page used to
-- build its action/admin dropdowns from the newest 2,000 rows, so older
-- actions couldn't be filtered on at all.
create or replace function public.admin_audit_facets()
returns table (kind text, value text, uses bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 'action', action, count(*) from public.admin_audit_logs group by action
  union all
  select 'admin', admin_username, count(*) from public.admin_audit_logs group by admin_username
  union all
  select 'target_type', target_type, count(*) from public.admin_audit_logs where target_type is not null group by target_type;
$$;

revoke execute on function public.admin_audit_facets() from public, anon, authenticated;
grant execute on function public.admin_audit_facets() to service_role;
