-- E-signatures, candidate self-service, interview self-booking, and merging
-- duplicate candidates.
--
-- signature_requests   a document (terms of business, offer letter,
--                      contract) sent to someone to sign on a private link
--                      (app/sign/[token]). The text signed is stored with a
--                      SHA-256 hash, plus the typed name, time, IP address
--                      and browser of whoever signed - the audit trail.
-- clients.terms_signed_at / terms_signature_id   the client's signed terms
-- candidate_portal_links   a private link (app/portal/[token]) where a
--                      candidate updates their details and availability and
--                      uploads documents (right to work, ID...)
-- interview_booking_links  times offered to a candidate, who picks one on a
--                      private link (app/book/[token]); picking books the
--                      interview
-- notifications        in-app notifications (the bell in the nav): someone
--                      signed, a candidate booked a time, an application
--                      came in... user_id null = everyone in the agency
-- merge_candidates()   moves everything from one duplicate candidate row to
--                      another and deletes the duplicate
--
-- Tokens are the only credential for the public pages. Service-role only:
-- RLS on, no policies. Agency foreign keys don't cascade - see
-- 20261001090000.

create table if not exists public.signature_requests (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references public.agencies(id),
  kind                text not null default 'other' check (kind in ('terms', 'offer', 'contract', 'other')),
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  body                text not null check (char_length(body) between 1 and 60000),
  document_hash       text not null,
  client_id           uuid references public.clients(id) on delete cascade,
  candidate_id        uuid references public.candidates(id) on delete cascade,
  placement_id        uuid references public.placements(id) on delete set null,
  signer_name         text not null check (char_length(btrim(signer_name)) between 1 and 200),
  signer_email        text check (signer_email is null or char_length(signer_email) <= 254),
  token               text not null unique,
  status              text not null default 'sent' check (status in ('sent', 'signed', 'declined', 'void')),
  sent_at             timestamptz,
  viewed_at           timestamptz,
  signed_at           timestamptz,
  signed_name         text check (signed_name is null or char_length(signed_name) <= 200),
  signed_ip           text check (signed_ip is null or char_length(signed_ip) <= 100),
  signed_user_agent   text check (signed_user_agent is null or char_length(signed_user_agent) <= 500),
  declined_reason     text check (declined_reason is null or char_length(declined_reason) <= 1000),
  expires_at          timestamptz,
  created_by          text,
  created_at          timestamptz not null default now()
);

create index if not exists signature_requests_agency_idx on public.signature_requests (agency_id, created_at desc);
create index if not exists signature_requests_client_idx on public.signature_requests (client_id) where client_id is not null;
create index if not exists signature_requests_candidate_idx on public.signature_requests (candidate_id) where candidate_id is not null;

alter table public.clients
  add column if not exists terms_signed_at timestamptz,
  add column if not exists terms_signature_id uuid references public.signature_requests(id) on delete set null;

create table if not exists public.candidate_portal_links (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  token         text not null unique,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists candidate_portal_links_candidate_idx on public.candidate_portal_links (candidate_id);

-- What the candidate tells us about themselves on the portal.
alter table public.candidates
  add column if not exists notice_period text check (notice_period is null or char_length(notice_period) <= 100),
  add column if not exists salary_expectation text check (salary_expectation is null or char_length(salary_expectation) <= 100),
  add column if not exists available_from date;

create table if not exists public.interview_booking_links (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  job_id            uuid references public.jobs(id) on delete set null,
  contact_id        uuid references public.client_contacts(id) on delete set null,
  round             integer check (round is null or round between 1 and 20),
  kind              text not null default 'video' check (kind in ('video', 'phone', 'in_person')),
  duration_minutes  integer not null default 60 check (duration_minutes between 5 and 600),
  location          text check (location is null or char_length(location) <= 500),
  interviewers      text check (interviewers is null or char_length(interviewers) <= 500),
  slots             jsonb not null check (jsonb_typeof(slots) = 'array'),
  token             text not null unique,
  status            text not null default 'open' check (status in ('open', 'booked', 'cancelled')),
  interview_id      uuid references public.interviews(id) on delete set null,
  booked_at         timestamptz,
  expires_at        timestamptz,
  created_by        text,
  created_at        timestamptz not null default now()
);

create index if not exists interview_booking_links_candidate_idx on public.interview_booking_links (candidate_id);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  user_id     text check (user_id is null or char_length(user_id) <= 64),
  kind        text not null check (char_length(kind) <= 60),
  title       text not null check (char_length(title) <= 300),
  body        text check (body is null or char_length(body) <= 1000),
  href        text check (href is null or char_length(href) <= 500),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_inbox_idx on public.notifications (agency_id, user_id, created_at desc);

alter table public.notifications enable row level security;
comment on table public.notifications is 'Service-role only. Agency and user scoping enforced in the Next.js API layer, not RLS.';

alter table public.signature_requests enable row level security;
alter table public.candidate_portal_links enable row level security;
alter table public.interview_booking_links enable row level security;
comment on table public.signature_requests is 'Service-role only. token is the signer''s only credential.';
comment on table public.candidate_portal_links is 'Service-role only. token is the candidate''s only credential.';
comment on table public.interview_booking_links is 'Service-role only. token is the candidate''s only credential.';

-- Moves every row that points at p_remove to p_keep (any public table with
-- a candidate_id column), fills p_keep's blanks from p_remove, and deletes
-- p_remove - all or nothing. Where moving a row would duplicate one p_keep
-- already has (a unique constraint, e.g. the same shortlist twice), that
-- row is dropped instead. Returns the removed row's CV path when
-- p_keep didn't take it over, so the caller can delete the file.
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
