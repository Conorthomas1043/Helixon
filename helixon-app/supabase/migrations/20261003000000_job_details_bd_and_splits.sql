-- Job ownership and terms, business development, and split fees.
--
-- jobs.owner_id        the recruiter responsible for the job (Clerk user id,
--                      like candidates.recruiter_id); "My jobs" filters on it
-- jobs.openings        how many people the client wants
-- jobs.fee_percent / fee_amount   the fee agreed for this job, when it
--                      differs from the client's standard terms
-- jobs.priority        low / normal / high / urgent
-- jobs.target_date     when the client wants it filled
-- clients.next_action  { label, dueAt, completed?, ownerId? } - a follow-up
--                      on the client, the same shape as candidates.next_action
-- client_opportunities business-development deals: a lead with a client or
--                      prospect, its stage, value and expected close
-- placements.splits    [{ recruiterId, percent }] when a placement's fee and
--                      credit are shared; null = all to placements.recruiter_id
--
-- Service-role only: RLS on, no policies. Agency foreign keys don't
-- cascade - see 20261001090000.

alter table public.jobs
  add column if not exists owner_id     text check (owner_id is null or char_length(owner_id) <= 64),
  add column if not exists openings     integer check (openings is null or openings between 1 and 1000),
  add column if not exists fee_percent  numeric(5, 2) check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 100)),
  add column if not exists fee_amount   numeric(12, 2) check (fee_amount is null or fee_amount >= 0),
  add column if not exists priority     text check (priority is null or priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists target_date  date;

create index if not exists jobs_agency_owner_idx on public.jobs (agency_id, owner_id);

alter table public.clients
  add column if not exists next_action jsonb check (next_action is null or jsonb_typeof(next_action) = 'object');

create table if not exists public.client_opportunities (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id),
  client_id       uuid not null references public.clients(id) on delete cascade,
  contact_id      uuid references public.client_contacts(id) on delete set null,
  job_id          uuid references public.jobs(id) on delete set null,
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  stage           text not null default 'lead' check (stage in ('lead', 'contacted', 'meeting', 'proposal', 'won', 'lost')),
  value           numeric(12, 2) check (value is null or value >= 0),
  probability     integer check (probability is null or probability between 0 and 100),
  expected_close  date,
  owner_id        text check (owner_id is null or char_length(owner_id) <= 64),
  notes           text check (notes is null or char_length(notes) <= 4000),
  lost_reason     text check (lost_reason is null or char_length(lost_reason) <= 500),
  closed_at       timestamptz,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists client_opportunities_agency_stage_idx on public.client_opportunities (agency_id, stage);
create index if not exists client_opportunities_client_idx on public.client_opportunities (client_id);

alter table public.client_opportunities enable row level security;
comment on table public.client_opportunities is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';

alter table public.placements
  add column if not exists splits jsonb check (splits is null or jsonb_typeof(splits) = 'array');
