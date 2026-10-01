-- Compliance: right-to-work and other checks, references, privacy notices.
--
-- candidates.privacy_notice_sent_at   when the agency sent them its privacy
--                                     notice (UK GDPR Art. 14 - people
--                                     sourced rather than applying must be
--                                     told within a month)
-- compliance_checks    right to work, DBS, ID, qualifications... with the
--                      date checked, expiry / follow-up date and an optional
--                      copy of the document (private "cvs" bucket, under
--                      <agency>/<candidate>/compliance/)
-- candidate_references  a referee asked for a reference by email; they
--                      answer on a private link (app/reference/[token])
--
-- Both cascade with the candidate, so erasure removes them (the stored
-- documents are removed by lib/candidate-erasure.js).
-- Agency foreign keys don't cascade - see 20261001090000.
-- Service-role only: RLS on, no policies.

alter table public.candidates
  add column if not exists privacy_notice_sent_at timestamptz;

create table if not exists public.compliance_checks (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies(id),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  kind           text not null check (kind in ('right_to_work', 'dbs', 'identity', 'qualification', 'licence', 'other')),
  label          text check (label is null or char_length(label) <= 120),
  status         text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  document_type  text check (document_type is null or char_length(document_type) <= 120),
  checked_on     date,
  expires_on     date,
  follow_up_on   date,
  notes          text check (notes is null or char_length(notes) <= 2000),
  document_path  text,
  document_name  text check (document_name is null or char_length(document_name) <= 200),
  document_mime  text,
  checked_by     text check (checked_by is null or char_length(checked_by) <= 200),
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists compliance_checks_candidate_id_idx on public.compliance_checks (candidate_id);
create index if not exists compliance_checks_agency_expiry_idx on public.compliance_checks (agency_id, expires_on) where expires_on is not null;

create table if not exists public.candidate_references (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  referee_name      text not null check (char_length(btrim(referee_name)) between 1 and 200),
  referee_email     text check (referee_email is null or char_length(referee_email) <= 254),
  referee_phone     text check (referee_phone is null or char_length(referee_phone) <= 40),
  referee_company   text check (referee_company is null or char_length(referee_company) <= 200),
  referee_title     text check (referee_title is null or char_length(referee_title) <= 200),
  relationship      text check (relationship is null or char_length(relationship) <= 200),
  token             text not null unique,
  status            text not null default 'requested' check (status in ('requested', 'received', 'declined')),
  answers           jsonb,
  requested_at      timestamptz,
  received_at       timestamptz,
  expires_at        timestamptz,
  created_by        text,
  created_at        timestamptz not null default now()
);

create index if not exists candidate_references_candidate_id_idx on public.candidate_references (candidate_id);
create index if not exists candidate_references_agency_open_idx on public.candidate_references (agency_id) where status = 'requested';

alter table public.compliance_checks enable row level security;
alter table public.candidate_references enable row level security;

comment on table public.compliance_checks is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.candidate_references is 'Service-role only. token is the referee''s only credential.';
