-- Clients and their contacts. Until now a job's client was only a text
-- field (jobs.client) with an optional email (jobs.client_email), so an
-- agency had no record of the companies it works for, the people it deals
-- with there, or its fee terms with them.
--
-- clients            one per company the agency recruits for (unique by
--                    name within the agency, case-insensitive)
-- client_contacts    hiring managers and other people at a client
-- client_activity    the client's timeline (calls, meetings, notes, jobs)
-- jobs.client_id     the client a job is for; jobs.contact_id the hiring
--                    contact. jobs.client / jobs.client_email are kept in
--                    step with them by the API so every existing reader of
--                    those columns keeps working.
--
-- Existing jobs are backfilled: one client per distinct jobs.client name,
-- and one contact per distinct jobs.client_email.
--
-- Agency foreign keys deliberately don't cascade: move_member_into_agency
-- deletes an emptied agency and relies on a foreign-key error to keep one
-- that still has data (see 20261001090000_move_member_new_tables.sql).
--
-- Service-role only, like the other agency tables: RLS on, no policies.

create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references public.agencies(id),
  name               text not null check (char_length(btrim(name)) between 1 and 200),
  website            text check (website is null or char_length(website) <= 300),
  industry           text check (industry is null or char_length(industry) <= 120),
  address            text check (address is null or char_length(address) <= 500),
  status             text not null default 'active' check (status in ('prospect', 'active', 'inactive')),
  -- Standard terms: fee as a percentage of first-year salary, days to pay
  -- an invoice, and the rebate (guarantee) period after a start date.
  fee_percent        numeric(5, 2) check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 100)),
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days between 0 and 365),
  rebate_days        integer check (rebate_days is null or rebate_days between 0 and 365),
  terms_notes        text check (terms_notes is null or char_length(terms_notes) <= 2000),
  owner_id           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists clients_agency_name_key on public.clients (agency_id, lower(btrim(name)));

create table if not exists public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  job_title   text check (job_title is null or char_length(job_title) <= 200),
  email       text check (email is null or char_length(email) <= 254),
  phone       text check (phone is null or char_length(phone) <= 40),
  is_primary  boolean not null default false,
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_at  timestamptz not null default now()
);

create index if not exists client_contacts_client_id_idx on public.client_contacts (client_id);
create index if not exists client_contacts_agency_id_idx on public.client_contacts (agency_id);

create table if not exists public.client_activity (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id),
  client_id   uuid not null references public.clients(id) on delete cascade,
  type        text not null check (char_length(type) <= 60),
  actor       text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists client_activity_client_idx on public.client_activity (client_id, created_at desc);
create index if not exists client_activity_agency_id_idx on public.client_activity (agency_id);

alter table public.jobs
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists contact_id uuid references public.client_contacts(id) on delete set null;

create index if not exists jobs_client_id_idx on public.jobs (client_id) where client_id is not null;
create index if not exists jobs_contact_id_idx on public.jobs (contact_id) where contact_id is not null;

-- Backfill: a client per distinct job client name...
insert into public.clients (agency_id, name)
select distinct on (j.agency_id, lower(btrim(j.client))) j.agency_id, btrim(j.client)
from public.jobs j
where j.agency_id is not null and j.client is not null and btrim(j.client) <> '' and char_length(btrim(j.client)) <= 200
order by j.agency_id, lower(btrim(j.client)), j.created_at
on conflict (agency_id, lower(btrim(name))) do nothing;

update public.jobs j
set client_id = c.id
from public.clients c
where j.client_id is null
  and c.agency_id = j.agency_id
  and j.client is not null
  and lower(btrim(c.name)) = lower(btrim(j.client));

-- ...and a contact per distinct client email on those jobs.
insert into public.client_contacts (agency_id, client_id, name, email, is_primary)
select distinct on (j.client_id, lower(btrim(j.client_email)))
  j.agency_id, j.client_id, split_part(btrim(j.client_email), '@', 1), lower(btrim(j.client_email)), true
from public.jobs j
where j.client_id is not null and j.client_email is not null and btrim(j.client_email) like '%_@_%'
  and not exists (
    select 1 from public.client_contacts cc
    where cc.client_id = j.client_id and cc.email = lower(btrim(j.client_email))
  )
order by j.client_id, lower(btrim(j.client_email)), j.created_at;

update public.jobs j
set contact_id = cc.id
from public.client_contacts cc
where j.contact_id is null
  and cc.client_id = j.client_id
  and j.client_email is not null
  and cc.email = lower(btrim(j.client_email));

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_activity enable row level security;

comment on table public.clients is 'Service-role only. Agency scoping enforced in the Next.js API layer (lib/customer-auth.js), not RLS.';
comment on table public.client_contacts is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.client_activity is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
