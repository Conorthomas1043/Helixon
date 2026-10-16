-- test_account_take_emails refused when no live test_accounts row matched,
-- so a workspace that had just bought a plan (converted_at set) could still
-- be refused for up to a minute while lib/agency/test-account.js's cache
-- on another server held the old row. Now only being over the cap refuses;
-- an agency with no live test account always may send. Execute is granted
-- to the service role explicitly, as the other console functions do.
create or replace function public.test_account_take_emails(p_agency_id uuid, p_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  update public.test_accounts
     set emails_today = (case when emails_day = current_date then emails_today else 0 end) + p_count,
         emails_day = current_date,
         emails_total = emails_total + p_count
   where agency_id = p_agency_id
     and converted_at is null
     and deleted_at is null
     and (case when emails_day = current_date then emails_today else 0 end) + p_count <= email_daily_cap
  returning true into allowed;
  if allowed then
    return true;
  end if;
  return not exists (
    select 1 from public.test_accounts
     where agency_id = p_agency_id and converted_at is null and deleted_at is null
  );
end;
$$;

revoke execute on function public.test_account_take_emails(uuid, integer) from public, anon, authenticated;
grant execute on function public.test_account_take_emails(uuid, integer) to service_role;
