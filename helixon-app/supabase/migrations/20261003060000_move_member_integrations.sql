-- move_member_into_agency taught the tables from 20261003050000: a moving
-- member's texts move with them; the old workspace's Xero / QuickBooks /
-- mailbox connections are dropped (they'd file the old workspace's mail and
-- invoices into the new one - reconnect after moving).

create or replace function public.move_member_into_agency(
  p_profile_id uuid,
  p_from uuid,
  p_to uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  moved jsonb := '{}'::jsonb;
  n bigint;
  t text;
  c record;
  existing uuid;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'move_member_into_agency: invalid agencies';
  end if;

  perform 1 from public.agencies where id in (p_from, p_to) order by id for update;

  if not exists (select 1 from public.profiles where id = p_profile_id and agency_id = p_from) then
    raise exception 'move_member_into_agency: profile is not in the source agency';
  end if;
  if not exists (select 1 from public.agencies where id = p_to) then
    raise exception 'move_member_into_agency: target agency not found';
  end if;
  if exists (select 1 from public.profiles where agency_id = p_from and id <> p_profile_id) then
    raise exception 'move_member_into_agency: source agency has other members';
  end if;
  if exists (select 1 from public.subscriptions where user_id = p_profile_id and status = 'active') then
    raise exception 'move_member_into_agency: source agency has an active subscription';
  end if;

  n := 0;
  for c in select id, name from public.clients where agency_id = p_from loop
    select id into existing from public.clients where agency_id = p_to and lower(btrim(name)) = lower(btrim(c.name)) limit 1;
    if existing is not null then
      update public.client_contacts set client_id = existing where client_id = c.id;
      update public.client_activity set client_id = existing where client_id = c.id;
      update public.jobs set client_id = existing where client_id = c.id;
      update public.email_messages set client_id = existing where client_id = c.id;
      update public.placements set client_id = existing where client_id = c.id;
      update public.invoices set client_id = existing where client_id = c.id;
      update public.client_opportunities set client_id = existing where client_id = c.id;
      update public.signature_requests set client_id = existing where client_id = c.id;
      delete from public.clients where id = c.id;
      n := n + 1;
    end if;
  end loop;
  moved := moved || jsonb_build_object('clients_merged', n);

  update public.invoices i
     set number = left(i.number, 30) || '-' || left(replace(i.id::text, '-', ''), 6)
   where i.agency_id = p_from
     and exists (select 1 from public.invoices o where o.agency_id = p_to and o.number = i.number);

  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where agency_id = p_from;
  delete from public.webhook_endpoints where agency_id = p_from;
  delete from public.member_tokens where agency_id = p_from;
  delete from public.integration_connections where agency_id = p_from;

  foreach t in array array[
    'jobs', 'candidates', 'scores', 'analyses', 'artifacts', 'candidate_notes',
    'feedback', 'feedback_requests', 'job_channels', 'job_templates', 'shortlists',
    'clients', 'client_contacts', 'client_activity', 'client_opportunities',
    'interviews', 'interview_feedback', 'interview_booking_links',
    'email_templates', 'email_sequences', 'sequence_enrollments', 'email_messages',
    'shortlist_shares', 'saved_searches',
    'placements', 'invoices', 'timesheets',
    'compliance_checks', 'candidate_references',
    'signature_requests', 'candidate_portal_links',
    'notifications', 'agency_audit_log', 'sms_messages',
    'api_keys'
  ] loop
    execute format('update public.%I set agency_id = $1 where agency_id = $2', t) using p_to, p_from;
    get diagnostics n = row_count;
    moved := moved || jsonb_build_object(t, n);
  end loop;

  update public.profiles set agency_id = p_to where id = p_profile_id;

  begin
    delete from public.agencies where id = p_from;
  exception when foreign_key_violation then
    moved := moved || jsonb_build_object('old_agency_kept', true);
  end;

  return moved;
end;
$$;

revoke all on function public.move_member_into_agency(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_member_into_agency(uuid, uuid, uuid) to service_role;
