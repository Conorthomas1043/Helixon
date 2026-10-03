-- Agency audit log and per-person private tokens (calendar feed, BCC
-- logging address), and every table added on 2026-10-03 taught to
-- move_member_into_agency.
--
-- agency_audit_log  who did what in the workspace: deletions and exports of
--                   candidate data, team and permission changes, settings,
--                   API keys and webhooks, merges, invoices... Shown to the
--                   owner and admins (/dashboard/settings/audit).
-- member_tokens     a private token per person and purpose:
--                     calendar  an .ics feed of their interviews to subscribe
--                               to from Google Calendar, Outlook or Apple
--                     bcc       log+<token>@<inbound domain> - BCC it on an
--                               email from your own inbox and it's filed on
--                               the candidate or client's timeline
--
-- Permissions themselves live in agencies.settings.permissions (no schema).
-- Service-role only: RLS on, no policies.

create table if not exists public.agency_audit_log (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id),
  actor_id     text check (actor_id is null or char_length(actor_id) <= 64),
  actor_name   text check (actor_name is null or char_length(actor_name) <= 200),
  action       text not null check (char_length(action) <= 80),
  target_type  text check (target_type is null or char_length(target_type) <= 40),
  target_id    text check (target_id is null or char_length(target_id) <= 64),
  summary      text check (summary is null or char_length(summary) <= 500),
  meta         jsonb,
  ip           text check (ip is null or char_length(ip) <= 100),
  created_at   timestamptz not null default now()
);

create index if not exists agency_audit_log_agency_idx on public.agency_audit_log (agency_id, created_at desc);

create table if not exists public.member_tokens (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  user_id     text not null check (char_length(user_id) <= 64),
  purpose     text not null check (purpose in ('calendar', 'bcc')),
  token       text not null unique,
  created_at  timestamptz not null default now(),
  unique (agency_id, user_id, purpose)
);

alter table public.agency_audit_log enable row level security;
alter table public.member_tokens enable row level security;
comment on table public.agency_audit_log is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.member_tokens is 'Service-role only. token is the only credential for the calendar feed and BCC address.';

-- move_member_into_agency: everything from 20261001090000 plus the tables
-- added since. A moving member's private tokens are dropped (they'd point
-- the old workspace's calendar/BCC at the new one); audit history moves.
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
    'notifications', 'agency_audit_log',
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
