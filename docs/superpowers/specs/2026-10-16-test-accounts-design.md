# Test accounts: design

**Goal:** an admin gives someone (a prospect, partner or tester) a working Helixon login without payment, watches what they do, and ends it at will. Approved in chat on 16 October 2026.

## What the admin does

New console page **Admin › Customers › Test accounts** (`/admin/test-accounts`).

**Create:** name, email, agency name, access length (7, 14 or 30 days, or no end date) and a monthly screening limit (default 50). Helixon:
1. creates the Clerk user (email, generated username, generated password; `publicMetadata.is_test_user = true`, `helixon_test_account = true`);
2. creates the profile and agency (`createProfileAndAgency`, plan `agency`);
3. writes a demo subscription row (no Stripe id, `demo_expires_at` = the end date), the same row Admin › Users' "grant demo access" writes;
4. sets `agencies.screening_cap`;
5. records a `test_accounts` row;
6. shows the password once (the same readable generator as staff accounts), plus the sign-in address.

The Clerk webhook ignores users with `publicMetadata.helixon_test_account`, so it doesn't try to make a second workspace or report an unpaid sign-up.

**Per-account controls:** extend the end date, end access now, change the screening limit, reset the password (shown once), delete. Every action is written to the admin audit log.

## What a test account can't do

`isTestAgency(agencyId)` (cached for a minute) is true for an agency with an unconverted, undeleted `test_accounts` row. When it's true:
- **Texting:** refused.
- **Email to people outside the workspace:** at most 20 a day (on top of the 1,000-an-hour agency cap). Alerts to the workspace's own members aren't counted.
- **API keys and outgoing webhooks:** can't be created.
- **Screening:** the agency's screening cap.

Access ends when `demo_expires_at` passes (the existing `grantsAccess` check). Ending it now sets the subscription to cancelled and `demo_expires_at` to now.

## What the tester sees

A slim banner on signed-in pages: "Test account · access until 30 October 2026" (or "Test account" with no end date). Nothing about monitoring. `/api/auth/me` returns `testAccount: { endsAt }` for it.

**Converting:** if they buy through checkout while signed in, the Stripe webhook links a real subscription to their profile. It also marks the test account `converted_at`, which lifts the limits and removes the banner.

## Monitoring

**List:** name, email, agency, status (active, expired, ended, converted), days left, first and last seen, and usage: screenings, candidates, jobs, emails sent.

**Timeline per account**, newest first, up to 200 entries, merged from:
- `test_accounts` events (created, first sign-in, extended, ended);
- `agency_audit_log` for the agency;
- `candidate_activity` for the agency's candidates (stage changes, notes, emails, interviews...), with the candidate's name;
- `scores` (screenings, with job title and score);
- `jobs` created.

**First and last seen:** `/api/auth/me` (every signed-in page load) sets `first_seen_at` once and updates `last_seen_at` at most every 5 minutes.

**Email alerts** (to the admin alert recipients: Admin › Security, else `SECURITY_ALERT_EMAIL`):
- first sign-in;
- first screening (from `/api/run`);
- daily summary from the existing `admin-daily` cron: each test account's activity in the last 24 hours, and any that expired.

## Data

Migration `test_accounts`:

| column | |
|---|---|
| `id` | uuid primary key |
| `agency_id` | uuid, unique, references agencies |
| `clerk_user_id` | text |
| `name`, `email` | text |
| `created_by` | admin username |
| `ends_at` | timestamptz, null means no end |
| `email_daily_cap` | integer, default 20 |
| `first_seen_at`, `last_seen_at`, `first_screening_at` | timestamptz |
| `ended_at`, `converted_at`, `deleted_at` | timestamptz |
| `created_at` | timestamptz |

RLS on, no policies (service-role only, like every other table).

## Code

- `lib/admin/test-accounts.js`: create, update and delete; list with usage; timeline; status. Status and timeline merging are pure functions with unit tests.
- `lib/agency/test-account.js`: `isTestAgency`, the email allowance check, `noteSeen` and `noteFirstScreening`, and the alerts.
- `app/api/admin/test-accounts/route.js`: GET list, POST create, PATCH actions, DELETE. Admin session plus CSRF, like the other admin routes.
- `app/api/admin/test-accounts/[id]/route.js`: GET one account with its timeline.
- `app/admin/test-accounts/page.js`: the page (table, a drawer with the timeline and actions, a create dialog). Built from the console's existing UI pieces.
- Hooks into existing code: the Clerk webhook skip; `sendAgencyEmail` (allowance); the SMS route; API key and webhook creation; `/api/auth/me` (seen plus the banner flag); `/api/run` (first screening); the Stripe webhook (`converted_at`); the `admin-daily` cron (summary); the dashboard banner component; the admin nav.

## Testing

Unit tests for:
- status (active, expired, ended, converted);
- timeline merging and ordering;
- `isTestAgency` and the email allowance;
- the create flow with Clerk and the database mocked, including cleanup when a step fails;
- the webhook skip.

Then the existing suite, typecheck, build and end-to-end tests before pushing.
