# Test accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins create no-payment Helixon logins for prospects from the console, with limits, and see everything those accounts do.

**Architecture:** A `test_accounts` table marks an agency as a test workspace. `lib/agency/test-account.js` is the customer-side gate and tracker: limits, seen times, alerts. `lib/admin/test-accounts.js` is the admin-side create/control/list/timeline. Existing routes call small hooks into the customer-side lib.

**Tech Stack:** Next.js 16 route handlers, Clerk backend SDK, Supabase service-role client, vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-test-accounts-design.md`

## Global Constraints

- The tester never sees anything about monitoring. Banner copy is exactly `Test account · access until <d Month yyyy>`, or `Test account` when there is no end date.
- Outside email limit: 20 a day (`email_daily_cap`, default 20). Emails to the workspace's own members (`toMember`) aren't counted.
- Default monthly screening cap: 50. Access lengths: 7, 14 or 30 days, or no end date.
- Admin routes: `requireAdminSession()`, then `verifyCsrf` on writes, then `writeAdminAudit` on every action. Never audit a password.
- Customer-side checks fail open on lookup errors, except where a refusal is the safe default. `isTestAgency` errors count as "not a test account".
- Route files export only handlers. New files add 0 typecheck errors.
- Passwords come from `generateEmployeePassword()` and are shown once.

## Review Focus

- **The Clerk webhook races the create flow.** `user.created` fires before the profile exists. It must not create a second agency or log an "unpaid sign-up" error. Test: `skips users flagged helixon_test_account`.
- **A partly failed create.** If Clerk succeeds but the database fails, the Clerk user and agency must be removed, so no orphan login remains. Test: `removes the Clerk user when the workspace can't be created`.
- **Converted accounts.** After a real checkout, the limits and banner must stop. Test: `isTestAgency is false once converted`.
- **Bulk email counts.** A bulk send of N emails counts N against the daily allowance, not 1. Test: `refuses when count would pass the cap`.
- **Ending an account that already has a real Stripe subscription.** It must never cancel a paying row. "End now" only touches rows with a null `stripe_subscription_id`. Test: `end only updates demo rows`.

---

### Task 1: Migration and customer-side library

**Files:**
- Create: `supabase/migrations/20261016020000_test_accounts.sql`
- Create: `lib/agency/test-account.js`
- Test: `lib/agency/test-account.test.js`

**Interfaces:**
- Produces:
  - `isTestAgency(agencyId) -> Promise<row|null>`: the unconverted, undeleted row, cached for 60s.
  - `testEmailRefusal(agencyId, count) -> Promise<string|null>`.
  - `TEST_FEATURE_REFUSAL`: the error string for blocked features.
  - `noteSeen(agencyId) -> Promise<void>`.
  - `noteFirstScreening(agencyId) -> Promise<void>`.
  - `testAccountStatus(row, now) -> "active"|"expired"|"ended"|"converted"|"deleted"` (pure).
  - `_clearTestAccountCache()`.

- [ ] Write the tests:
  - **status**: ended_at set gives "ended"; converted_at gives "converted"; ends_at in the past gives "expired"; ends_at null gives "active".
  - **Email allowance**: with 19 sent today and cap 20, `testEmailRefusal(id, 1)` is null and `testEmailRefusal(id, 2)` is a string. A non-test agency gives null.
  - **Converted accounts**: `isTestAgency` is false once converted, because the query filters `converted_at is null`.
- [ ] Run `npx vitest run lib/agency/test-account.test.js`. Expect FAIL.
- [ ] Implement. Emails sent today = `email_messages` with `direction='out'` for the agency since UTC midnight, using a count head query. `noteSeen` writes `last_seen_at` only when it is more than 5 minutes old. It sets `first_seen_at` and sends a "first sign-in" alert when that is null, using a conditional update (`.is("first_seen_at", null)`) so the alert sends once. `noteFirstScreening` follows the same pattern for `first_screening_at`.
- [ ] Run the test. Expect PASS. Commit.

### Task 2: Admin library

**Files:**
- Create: `lib/admin/test-accounts.js`
- Test: `lib/admin/test-accounts.test.js`

**Interfaces:**
- Consumes: `testAccountStatus`.
- Produces:
  - `createTestAccount({ client, supabase, input, admin }) -> { account, password, username } | { status, error }`.
  - `applyTestAccountAction({ client, supabase, account, action, body }) -> { result? } | { status, error }`. Actions: `extend` {days}, `end`, `set_cap` {cap}, `reset_password`, `reactivate` {days}.
  - `deleteTestAccount({ client, supabase, account })`.
  - `listTestAccounts(supabase) -> rows with status, usage`.
  - `testAccountTimeline(supabase, account) -> entries[]`.
  - `mergeTimeline(sources) -> entries[]` (pure; newest first, max 200).
  - `endsAtFor(days, now) -> iso|null`.

- [ ] Write the tests:
  - `mergeTimeline` orders newest first and caps at 200.
  - `endsAtFor` takes 7, 14 or 30; anything else (`null`, `"none"`, 0) means no end; the maximum is 365.
  - Create flow, with Clerk and Supabase mocked: success returns a password; a profile failure deletes the Clerk user.
  - `end only updates demo rows`: the subscription update chain includes `.is("stripe_subscription_id", null)`.
- [ ] Run. Expect FAIL.
- [ ] Implement. Create steps:
  1. Validate the email and names.
  2. Check that no Clerk user already has that email.
  3. Generate the username with `generateUsername` and the password.
  4. `client.users.createUser({ emailAddress:[email], username, password, firstName, lastName, skipPasswordChecks:false, publicMetadata:{ is_test_user:true, test_label:"Test account", helixon_test_account:true } })`.
  5. `createProfileAndAgency({ plan:"agency" })`.
  6. Upsert the subscription row (plan `agency`, status active, no Stripe id, `demo_expires_at`).
  7. Set `agencies.screening_cap`.
  8. Insert into `test_accounts`.
  9. On any failure after step 4, delete the agency (and its profile) and the Clerk user.
- [ ] Run. Expect PASS. Commit.

### Task 3: Admin API routes and page

**Files:**
- Create: `app/api/admin/test-accounts/route.js` (GET list, POST create, PATCH action, DELETE).
- Create: `app/api/admin/test-accounts/[id]/route.js` (GET detail with timeline).
- Create: `app/admin/test-accounts/page.js`.
- Modify: `app/admin/_shared/nav.js`: add `{ href:"/admin/test-accounts", label:"Test accounts", icon:"users", hint:"Free logins for prospects, and what they do" }` after Users.

- [ ] Routes follow `app/api/admin/users/route.js`, with zod `fields(...)` inputs. Audit actions are `test_account_create`, `test_account_<action>` and `test_account_delete`, with `targetType` "test_account".
- [ ] Page:
  - A `DataTable` with columns name/email, agency, status, days left, last seen, screenings, candidates, jobs, emails.
  - A create drawer that shows the password and sign-in URL once via `SecretReveal`.
  - A detail drawer with the actions and the timeline.
- [ ] `npm run lint` and `npm run typecheck`: clean. Commit.

### Task 4: Hooks into existing code

**Files (modify):**
- `app/api/webhooks/clerk/route.js` `handleUserCreated`: return early when `clerkUser.public_metadata?.helixon_test_account`. Test it in `app/api/webhooks/clerk/route.test.js` if that exists, else as a unit-level check.
- `lib/messaging/mailer.js` `agencySendRefusal`: when `!toMember`, return `await testEmailRefusal(agencyId, count)` if non-null.
- `app/api/candidates/[id]/sms/route.js` POST: refuse 403 with `TEST_FEATURE_REFUSAL` when `isTestAgency`.
- `app/api/integrations/keys/route.js` POST and `app/api/integrations/webhooks/route.js` POST: same refusal.
- `app/api/auth/me/route.js`: when `isTestAgency`, add `testAccount: { endsAt }` and call `noteSeen` in `after()`.
- `app/api/run/route.js`: `after(() => noteFirstScreening(agencyId))`.
- `app/api/webhooks/stripe/route.js` checkout completed: set `converted_at` on the test account for that profile's agency.
- `app/api/cron/admin-daily/route.js`: a new step, `testAccountDigest`, emails a 24h summary and the expiries when there are any test accounts.
- `components/DashboardNav.jsx`: a `TestAccountBanner` when `me.testAccount`.

- [ ] Write/extend the tests for the mailer allowance and the webhook skip. Run: FAIL, then implement, then PASS.
- [ ] Full checks: `npm run check`, `npm run build`, `npm run test:e2e`.
- [ ] Apply the migration via the Supabase MCP. Push to main.
