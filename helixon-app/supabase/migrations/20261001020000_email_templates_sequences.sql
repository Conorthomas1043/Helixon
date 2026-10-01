-- Recruiter email: reusable templates, a per-candidate thread of what was
-- sent and received, and automated follow-up sequences.
--
-- email_templates        an agency's saved emails with merge fields
--                        ({{candidate.first_name}}, {{job.title}} ...)
-- email_messages         every email sent to or received from a candidate
--                        or client contact through Helixon. reply_token
--                        makes the Reply-To address unique per message
--                        (reply+<token>@<inbound domain>), so a reply can be
--                        matched back to who it's from.
-- email_sequences        named series of timed steps (day 0, day 3, ...)
-- sequence_enrollments   a candidate working through a sequence; stops on
--                        a reply, a final stage or by hand.
--
-- Agency foreign keys don't cascade - see 20261001090000. Candidate
-- erasure removes a candidate's messages and enrollments (cascade).
-- Service-role only: RLS on, no policies.

create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  audience    text not null default 'candidate' check (audience in ('candidate', 'client')),
  subject     text not null check (char_length(subject) between 1 and 300),
  body        text not null check (char_length(body) between 1 and 20000),
  uses        integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists email_templates_agency_id_idx on public.email_templates (agency_id);

create table if not exists public.email_sequences (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  -- [{ delayDays, subject, body }] - delayDays counts from the previous step
  steps       jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists email_sequences_agency_id_idx on public.email_sequences (agency_id);

create table if not exists public.sequence_enrollments (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id),
  sequence_id     uuid not null references public.email_sequences(id) on delete cascade,
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  next_step       integer not null default 0,
  next_send_at    timestamptz,
  status          text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stopped_reason  text check (stopped_reason is null or char_length(stopped_reason) <= 200),
  enrolled_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One live enrollment per candidate per sequence.
create unique index if not exists sequence_enrollments_active_key
  on public.sequence_enrollments (sequence_id, candidate_id) where status = 'active';
create index if not exists sequence_enrollments_due_idx
  on public.sequence_enrollments (next_send_at) where status = 'active';
create index if not exists sequence_enrollments_candidate_id_idx on public.sequence_enrollments (candidate_id);
create index if not exists sequence_enrollments_agency_id_idx on public.sequence_enrollments (agency_id);

create table if not exists public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id),
  candidate_id    uuid references public.candidates(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  direction       text not null check (direction in ('out', 'in')),
  from_email      text check (from_email is null or char_length(from_email) <= 320),
  to_email        text check (to_email is null or char_length(to_email) <= 2000),
  subject         text check (subject is null or char_length(subject) <= 500),
  body_text       text check (body_text is null or char_length(body_text) <= 50000),
  provider_id     text,
  reply_token     text unique,
  in_reply_to     uuid references public.email_messages(id) on delete set null,
  template_id     uuid references public.email_templates(id) on delete set null,
  enrollment_id   uuid references public.sequence_enrollments(id) on delete set null,
  sent_by         text,
  created_at      timestamptz not null default now()
);

create index if not exists email_messages_candidate_idx on public.email_messages (candidate_id, created_at desc) where candidate_id is not null;
create index if not exists email_messages_client_id_idx on public.email_messages (client_id) where client_id is not null;
create index if not exists email_messages_agency_id_idx on public.email_messages (agency_id);
create index if not exists email_messages_in_reply_to_idx on public.email_messages (in_reply_to) where in_reply_to is not null;
create index if not exists email_messages_template_id_idx on public.email_messages (template_id) where template_id is not null;
create index if not exists email_messages_enrollment_id_idx on public.email_messages (enrollment_id) where enrollment_id is not null;

alter table public.email_templates enable row level security;
alter table public.email_sequences enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.email_messages enable row level security;

comment on table public.email_templates is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.email_sequences is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.sequence_enrollments is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.email_messages is 'Service-role only. reply_token is matched against inbound mail (app/api/webhooks/resend-inbound).';
