-- Sharing a shortlist with a client. A share is a private link
-- (/share/<token>) that shows the hiring manager client-ready profiles of
-- everyone on the list (optionally anonymised) and lets them say, per
-- person, "interview", "maybe" or "no" with a comment - which lands back
-- on the shortlist and the candidate's timeline.
--
-- shortlist_shares               one per link; can expire or be revoked
-- shortlist_candidates.client_*  the client's latest response per person
--
-- Agency foreign keys don't cascade - see 20261001090000.
-- Service-role only: RLS on, no policies.

create table if not exists public.shortlist_shares (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id),
  shortlist_id      uuid not null references public.shortlists(id) on delete cascade,
  token             text not null unique,
  blind             boolean not null default false,
  include_concerns  boolean not null default false,
  show_score        boolean not null default true,
  recipient_name    text check (recipient_name is null or char_length(recipient_name) <= 200),
  recipient_email   text check (recipient_email is null or char_length(recipient_email) <= 254),
  expires_at        timestamptz,
  revoked_at        timestamptz,
  last_viewed_at    timestamptz,
  view_count        integer not null default 0,
  created_by        text,
  created_at        timestamptz not null default now()
);

create index if not exists shortlist_shares_shortlist_id_idx on public.shortlist_shares (shortlist_id);
create index if not exists shortlist_shares_agency_id_idx on public.shortlist_shares (agency_id);

alter table public.shortlist_candidates
  add column if not exists client_decision text,
  add column if not exists client_comment text,
  add column if not exists client_decided_at timestamptz,
  add column if not exists client_decided_by text;

alter table public.shortlist_candidates drop constraint if exists shortlist_candidates_client_decision_check;
alter table public.shortlist_candidates
  add constraint shortlist_candidates_client_decision_check
  check (client_decision is null or client_decision in ('interview', 'maybe', 'reject'));
alter table public.shortlist_candidates drop constraint if exists shortlist_candidates_client_text_length;
alter table public.shortlist_candidates
  add constraint shortlist_candidates_client_text_length
  check ((client_comment is null or char_length(client_comment) <= 2000) and (client_decided_by is null or char_length(client_decided_by) <= 200));

create index if not exists shortlist_candidates_shortlist_id_idx on public.shortlist_candidates (shortlist_id);
create index if not exists shortlist_candidates_candidate_id_idx on public.shortlist_candidates (candidate_id);

alter table public.shortlist_shares enable row level security;

comment on table public.shortlist_shares is 'Service-role only. token is a bearer secret for the public client review page (app/share/[token]).';
