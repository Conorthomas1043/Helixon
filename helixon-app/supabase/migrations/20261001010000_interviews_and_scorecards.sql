-- Interviews and interview scorecards. The pipeline had an "Interview"
-- stage but nowhere to record when an interview is, who it's with, or how
-- it went.
--
-- interviews          one per scheduled interview (a candidate can have
--                     several rounds). Calendar invites are emailed as
--                     .ics files; ics_sequence goes up with each change so
--                     calendars update the same event.
-- interview_feedback  a scorecard: an overall rating, a recommendation and
--                     per-criterion ratings. Filled in by a recruiter, or by
--                     an interviewer at the client through a private link
--                     (token) without an account.
--
-- Candidate erasure removes both (cascade from candidates). Agency foreign
-- keys don't cascade - see 20261001090000_move_member_new_tables.sql.
-- Service-role only: RLS on, no policies.

create table if not exists public.interviews (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  job_id            uuid references public.jobs(id) on delete set null,
  contact_id        uuid references public.client_contacts(id) on delete set null,
  round             integer not null default 1 check (round between 1 and 20),
  kind              text not null default 'video' check (kind in ('video', 'phone', 'in_person')),
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 60 check (duration_minutes between 5 and 600),
  location          text check (location is null or char_length(location) <= 500),
  interviewers      text check (interviewers is null or char_length(interviewers) <= 500),
  notes             text check (notes is null or char_length(notes) <= 2000),
  status            text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  outcome           text check (outcome is null or outcome in ('progress', 'hold', 'reject')),
  ics_sequence      integer not null default 0,
  invited_at        timestamptz,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists interviews_agency_starts_idx on public.interviews (agency_id, starts_at);
create index if not exists interviews_candidate_id_idx on public.interviews (candidate_id);
create index if not exists interviews_job_id_idx on public.interviews (job_id) where job_id is not null;
create index if not exists interviews_contact_id_idx on public.interviews (contact_id) where contact_id is not null;

create table if not exists public.interview_feedback (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id),
  interview_id     uuid not null references public.interviews(id) on delete cascade,
  token            text unique,
  reviewer_name    text check (reviewer_name is null or char_length(reviewer_name) <= 200),
  reviewer_email   text check (reviewer_email is null or char_length(reviewer_email) <= 254),
  overall_rating   integer check (overall_rating is null or overall_rating between 1 and 5),
  recommendation   text check (recommendation is null or recommendation in ('strong_yes', 'yes', 'no', 'strong_no')),
  criteria         jsonb not null default '[]'::jsonb,
  strengths        text check (strengths is null or char_length(strengths) <= 3000),
  concerns         text check (concerns is null or char_length(concerns) <= 3000),
  comments         text check (comments is null or char_length(comments) <= 3000),
  submitted_at     timestamptz,
  created_by       text,
  created_at       timestamptz not null default now()
);

create index if not exists interview_feedback_interview_id_idx on public.interview_feedback (interview_id);
create index if not exists interview_feedback_agency_id_idx on public.interview_feedback (agency_id);

alter table public.interviews enable row level security;
alter table public.interview_feedback enable row level security;

comment on table public.interviews is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.interview_feedback is 'Service-role only. The token is a bearer secret for the public scorecard page (app/scorecard/[token]).';
