-- Closing the gaps from the admin audit: demo access and bans that end on
-- their own, and firewall rules for request paths and user agents.
-- Additive only.

-- Demo access granted from Admin > Users can have an end date. Checked on
-- every customer request (lib/customer-auth.js), so it ends on time; the
-- daily admin cron then marks the row cancelled for the Billing page.
alter table public.subscriptions
  add column if not exists demo_expires_at timestamptz;

-- Bans with an end date. Clerk bans have no duration, so the end date
-- lives here and the daily admin cron (/api/cron/admin-daily) lifts the
-- ban once it has passed. A ban without an end date has no row.
create table if not exists public.timed_bans (
  user_id text primary key,
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 300),
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.timed_bans enable row level security;
comment on table public.timed_bans is
  'End dates for customer bans set from the admin console; lifted by /api/cron/admin-daily. Service-role only.';

-- Firewall rules can also refuse requests by path prefix (e.g. /wp-admin)
-- or by a fragment of the user agent (e.g. sqlmap).
alter table public.firewall_rules drop constraint if exists firewall_rules_kind_check;
alter table public.firewall_rules
  add constraint firewall_rules_kind_check
  check (kind in ('allow_ip', 'block_country', 'block_path', 'block_ua'));
