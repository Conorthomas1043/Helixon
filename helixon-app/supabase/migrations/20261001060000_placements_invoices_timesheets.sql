-- Offers, placements, invoices and contractor timesheets.
--
-- placements   an offer and what came of it: permanent (salary, fee % and
--              fee, rebate period) or contract (pay and charge rates per
--              hour/day, end date). candidate_name/job_title/client_name are
--              kept on the record because it backs invoices, which must be
--              retained for accounting even after a candidate is erased
--              (candidate_id then goes null).
-- invoices     what was billed: numbered per agency, lines, VAT, totals,
--              a snapshot of who it was billed to, and whether it's paid.
-- timesheets   a contractor's hours or days per week, approved and then
--              invoiced.
--
-- Agency foreign keys don't cascade - see 20261001090000.
-- Service-role only: RLS on, no policies.

create table if not exists public.placements (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id),
  candidate_id     uuid references public.candidates(id) on delete set null,
  job_id           uuid references public.jobs(id) on delete set null,
  client_id        uuid references public.clients(id) on delete set null,
  recruiter_id     text,
  candidate_name   text check (candidate_name is null or char_length(candidate_name) <= 200),
  job_title        text check (job_title is null or char_length(job_title) <= 200),
  client_name      text check (client_name is null or char_length(client_name) <= 200),
  kind             text not null default 'permanent' check (kind in ('permanent', 'contract')),
  status           text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'started', 'fell_through', 'completed')),
  currency         text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  offer_date       date,
  start_date       date,
  end_date         date,
  salary           numeric(12, 2) check (salary is null or salary >= 0),
  fee_percent      numeric(5, 2) check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 100)),
  fee_amount       numeric(12, 2) check (fee_amount is null or fee_amount >= 0),
  rate_unit        text check (rate_unit is null or rate_unit in ('hour', 'day')),
  pay_rate         numeric(10, 2) check (pay_rate is null or pay_rate >= 0),
  charge_rate      numeric(10, 2) check (charge_rate is null or charge_rate >= 0),
  rebate_days      integer check (rebate_days is null or rebate_days between 0 and 365),
  rebate_until     date,
  notes            text check (notes is null or char_length(notes) <= 2000),
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists placements_agency_idx on public.placements (agency_id, created_at desc);
create index if not exists placements_candidate_id_idx on public.placements (candidate_id) where candidate_id is not null;
create index if not exists placements_job_id_idx on public.placements (job_id) where job_id is not null;
create index if not exists placements_client_id_idx on public.placements (client_id) where client_id is not null;

create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id),
  client_id     uuid references public.clients(id) on delete set null,
  placement_id  uuid references public.placements(id) on delete set null,
  number        text not null check (char_length(number) between 1 and 40),
  status        text not null default 'sent' check (status in ('draft', 'sent', 'paid', 'void')),
  currency      text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  issued_on     date not null default current_date,
  due_on        date,
  paid_on       date,
  bill_to       jsonb not null default '{}'::jsonb,
  lines         jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  subtotal      numeric(12, 2) not null default 0,
  vat_rate      numeric(5, 2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  vat_amount    numeric(12, 2) not null default 0,
  total         numeric(12, 2) not null default 0,
  notes         text check (notes is null or char_length(notes) <= 2000),
  created_by    text,
  created_at    timestamptz not null default now(),
  unique (agency_id, number)
);

create index if not exists invoices_client_id_idx on public.invoices (client_id) where client_id is not null;
create index if not exists invoices_placement_id_idx on public.invoices (placement_id) where placement_id is not null;
create index if not exists invoices_unpaid_idx on public.invoices (agency_id, due_on) where status = 'sent';

create table if not exists public.timesheets (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies(id),
  placement_id   uuid not null references public.placements(id) on delete cascade,
  week_starting  date not null,
  quantity       numeric(6, 2) not null check (quantity >= 0 and quantity <= 168),
  status         text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'invoiced')),
  approved_by    text check (approved_by is null or char_length(approved_by) <= 200),
  approved_at    timestamptz,
  invoice_id     uuid references public.invoices(id) on delete set null,
  notes          text check (notes is null or char_length(notes) <= 1000),
  created_by     text,
  created_at     timestamptz not null default now(),
  unique (placement_id, week_starting)
);

create index if not exists timesheets_agency_id_idx on public.timesheets (agency_id);
create index if not exists timesheets_invoice_id_idx on public.timesheets (invoice_id) where invoice_id is not null;

alter table public.placements enable row level security;
alter table public.invoices enable row level security;
alter table public.timesheets enable row level security;

comment on table public.placements is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
comment on table public.invoices is 'Service-role only. Kept for accounting after a candidate is erased.';
comment on table public.timesheets is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
