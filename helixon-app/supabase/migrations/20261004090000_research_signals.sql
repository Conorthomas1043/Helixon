-- Research signals: what customers tell Helixon, in one place, for the
-- admin "Voice of customer" page (docs/ux-research-audit.md, R8). Before
-- this, analysis disagreements fed calibration only, chat-assistant
-- questions were discarded and cancellation reasons only reached PostHog.
--
--   kind                  body                         who
--   cancellation_reason   optional free text           agency admin
--   assistant_question    visitor's question (scrubbed) consented visitors
--   pulse_survey          optional free text           recruiter
--   research_optin        -                            recruiter / demo lead
--
-- Service-role only: RLS on, no policies (same as agency_audit_log). Rows
-- go when their agency is deleted (erasure), and the data-retention cron
-- removes anything older than 24 months (storage limitation).

create table if not exists public.research_signals (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('cancellation_reason', 'assistant_question', 'pulse_survey', 'research_optin')),
  agency_id   uuid references public.agencies(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  score       smallint check (score is null or score between 0 and 10),
  label       text check (label is null or char_length(label) <= 80),
  body        text check (body is null or char_length(body) <= 2000),
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists research_signals_kind_created_idx on public.research_signals (kind, created_at desc);
create index if not exists research_signals_agency_idx on public.research_signals (agency_id) where agency_id is not null;
create index if not exists research_signals_profile_idx on public.research_signals (profile_id) where profile_id is not null;

alter table public.research_signals enable row level security;
comment on table public.research_signals is 'Service-role only. Customer feedback for research; read on the admin Voice of customer page.';
