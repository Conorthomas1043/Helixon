-- Accounting and mailbox connections, text messages, and offices.
--
-- integration_connections  an OAuth connection to another service:
--                    xero / quickbooks   one per agency (invoices are pushed
--                                        to the agency's accounts)
--                    gmail / outlook     one per person (their mailbox is
--                                        read and emails to and from
--                                        candidates and client contacts are
--                                        filed on their timelines)
--                  tokens is AES-256-GCM ciphertext (lib/secret-box.js),
--                  never plaintext. sync_cursor is where the last mailbox
--                  sync got to.
-- invoices.external_*      the copy of an invoice in Xero / QuickBooks
-- sms_messages     texts to and from candidates (Twilio). An inbound text
--                  is matched to the candidate last texted from that
--                  number.
-- jobs.office_id   which office or brand a job belongs to; the offices
--                  themselves are agencies.settings.offices
--                  [{ id, name }] and who's in which is
--                  agencies.settings.memberOffices { userId: officeId }.
--
-- Service-role only: RLS on, no policies. Agency foreign keys don't
-- cascade - see 20261001090000.

create table if not exists public.integration_connections (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id),
  user_id         text check (user_id is null or char_length(user_id) <= 64),
  provider        text not null check (provider in ('xero', 'quickbooks', 'gmail', 'outlook')),
  account_id      text check (account_id is null or char_length(account_id) <= 200),
  account_name    text check (account_name is null or char_length(account_name) <= 300),
  tokens          text not null,
  expires_at      timestamptz,
  sync_cursor     text check (sync_cursor is null or char_length(sync_cursor) <= 2000),
  last_synced_at  timestamptz,
  last_error      text check (last_error is null or char_length(last_error) <= 1000),
  connected_by    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One accounting connection per agency, one mailbox per person.
create unique index if not exists integration_connections_owner_key
  on public.integration_connections (agency_id, provider, coalesce(user_id, ''));
create index if not exists integration_connections_provider_idx on public.integration_connections (provider);

alter table public.integration_connections enable row level security;
comment on table public.integration_connections is 'Service-role only. tokens is encrypted (lib/secret-box.js).';

alter table public.invoices
  add column if not exists external_provider text check (external_provider is null or external_provider in ('xero', 'quickbooks')),
  add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200),
  add column if not exists external_synced_at timestamptz;

create table if not exists public.sms_messages (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id),
  candidate_id  uuid references public.candidates(id) on delete cascade,
  direction     text not null check (direction in ('in', 'out')),
  to_number     text not null check (char_length(to_number) <= 32),
  from_number   text not null check (char_length(from_number) <= 32),
  body          text not null check (char_length(body) <= 1600),
  provider_id   text check (provider_id is null or char_length(provider_id) <= 100),
  status        text check (status is null or char_length(status) <= 40),
  sent_by       text check (sent_by is null or char_length(sent_by) <= 64),
  created_at    timestamptz not null default now()
);

create index if not exists sms_messages_candidate_idx on public.sms_messages (candidate_id, created_at desc);
create index if not exists sms_messages_agency_idx on public.sms_messages (agency_id);
-- Inbound texts look up who was last texted at the sender's number.
create index if not exists sms_messages_to_number_idx on public.sms_messages (to_number, created_at desc) where direction = 'out';
create unique index if not exists sms_messages_provider_key on public.sms_messages (provider_id) where provider_id is not null;

alter table public.sms_messages enable row level security;
comment on table public.sms_messages is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';

alter table public.jobs
  add column if not exists office_id text check (office_id is null or char_length(office_id) <= 40);
create index if not exists jobs_agency_office_idx on public.jobs (agency_id, office_id) where office_id is not null;
