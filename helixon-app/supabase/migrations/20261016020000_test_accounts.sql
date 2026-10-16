-- Test accounts (Admin > Customers > Test accounts): a working Helixon
-- login given to a prospect without payment. The agency gets a demo
-- subscription row as usual; this row marks it as a test workspace, which
-- limits outside email, texting, API keys and webhooks
-- (lib/agency/test-account.js), and records what the admin console shows
-- about it. A real checkout sets converted_at, which lifts the limits.
create table if not exists public.test_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  clerk_user_id text,
  name text not null,
  email text not null,
  created_by text,
  ends_at timestamptz,
  email_daily_cap integer not null default 20 check (email_daily_cap between 0 and 1000),
  emails_day date,
  emails_today integer not null default 0,
  emails_total integer not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  first_screening_at timestamptz,
  ended_at timestamptz,
  converted_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists test_accounts_clerk_user_id_idx on public.test_accounts (clerk_user_id);

-- Service-role only, like every other table.
alter table public.test_accounts enable row level security;

-- Takes p_count emails from a live test account's daily allowance, all or
-- nothing, in one statement so two sends can't both slip under the cap.
-- The day is the database's (UTC). True when allowed.
create or replace function public.test_account_take_emails(p_agency_id uuid, p_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  update public.test_accounts
     set emails_today = (case when emails_day = current_date then emails_today else 0 end) + p_count,
         emails_day = current_date,
         emails_total = emails_total + p_count
   where agency_id = p_agency_id
     and converted_at is null
     and deleted_at is null
     and (case when emails_day = current_date then emails_today else 0 end) + p_count <= email_daily_cap
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;

revoke execute on function public.test_account_take_emails(uuid, integer) from public, anon, authenticated;
