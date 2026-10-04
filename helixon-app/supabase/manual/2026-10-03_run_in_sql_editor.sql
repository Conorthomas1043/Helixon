-- Helixon: run this once in Supabase → SQL Editor (project "Helixon").
-- It installs two database functions that the automated run couldn't apply,
-- because they contain DELETE statements, which need a person to confirm.
-- Safe to run more than once. Every table and column is already in place.

-- 1) merge_candidates(): powers "Merge duplicate" on a candidate profile
create or replace function public.merge_candidates(
  p_agency uuid,
  p_keep uuid,
  p_remove uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  k public.candidates%rowtype;
  r public.candidates%rowtype;
  t text;
  n bigint;
  rid tid;
  moved jsonb := '{}'::jsonb;
begin
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'merge_candidates: pick two different candidates';
  end if;
  select * into k from public.candidates where id = p_keep and agency_id = p_agency for update;
  select * into r from public.candidates where id = p_remove and agency_id = p_agency for update;
  if k.id is null or r.id is null then
    raise exception 'merge_candidates: candidate not found';
  end if;

  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'candidate_id'
       and tb.table_type = 'BASE TABLE'
       and c.table_name <> 'candidates'
  loop
    begin
      execute format('update public.%I set candidate_id = $1 where candidate_id = $2', t) using p_keep, p_remove;
      get diagnostics n = row_count;
    exception when unique_violation then
      -- Some rows clash with ones p_keep already has: move them one at a
      -- time and drop only the ones that clash.
      n := 0;
      for rid in execute format('select ctid from public.%I where candidate_id = $1', t) using p_remove loop
        begin
          execute format('update public.%I set candidate_id = $1 where ctid = $2', t) using p_keep, rid;
          n := n + 1;
        exception when unique_violation then
          execute format('delete from public.%I where ctid = $1', t) using rid;
        end;
      end loop;
    end;
    if n <> 0 then moved := moved || jsonb_build_object(t, n); end if;
  end loop;

  -- Anyone re-screened from the duplicate now hangs off the kept row's person.
  update public.candidates
     set pooled_from_id = coalesce(k.pooled_from_id, k.id)
   where pooled_from_id = p_remove and agency_id = p_agency;

  update public.candidates set
    email = coalesce(k.email, r.email),
    phone = coalesce(k.phone, r.phone),
    linkedin = coalesce(k.linkedin, r.linkedin),
    location = coalesce(k.location, r.location),
    current_title = coalesce(k.current_title, r.current_title),
    current_company = coalesce(k.current_company, r.current_company),
    cv_text = coalesce(k.cv_text, r.cv_text),
    cv_file_url = coalesce(k.cv_file_url, r.cv_file_url),
    cv_filename = coalesce(k.cv_filename, r.cv_filename),
    tags = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(k.tags, '{}') || coalesce(r.tags, '{}')) as x),
    next_action = coalesce(k.next_action, r.next_action),
    talent_pool_at = coalesce(k.talent_pool_at, r.talent_pool_at),
    last_activity_at = greatest(k.last_activity_at, r.last_activity_at, now())
  where id = p_keep;

  delete from public.candidates where id = p_remove;

  return moved || jsonb_build_object(
    'orphaned_cv', case when r.cv_file_url is not null and r.cv_file_url is distinct from coalesce(k.cv_file_url, r.cv_file_url) then r.cv_file_url else null end
  );
end;
$$;

revoke all on function public.merge_candidates(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_candidates(uuid, uuid, uuid) to service_role;

-- 2) move_member_into_agency(): moving someone between workspaces now also
--    moves deals, e-signatures, booking and portal links, notifications,
--    audit history and texts (and drops the old workspace's connections)
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

-- Check: both columns should say true
select
  exists (select 1 from pg_proc where proname = 'merge_candidates' and pronamespace = 'public'::regnamespace) as merge_installed,
  exists (select 1 from pg_proc where proname = 'move_member_into_agency' and pronamespace = 'public'::regnamespace and prosrc like '%sms_messages%') as move_updated;
