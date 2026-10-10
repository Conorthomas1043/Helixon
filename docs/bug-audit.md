# Helixon: bug audit

**Scope:** `helixon-app` at `2740bd7` (main), about 110k lines.

**How it was done:**
- **Read line by line:** `proxy.ts`, every auth and session library, every customer, public-token, webhook and cron route, and the core `lib/` modules they call (billing, permissions, erasure, retention, email, firewall, integrations). Also the SQL functions and RLS migration.
- **Read more lightly:** the admin and staff-portal routes. They are behind their own logins and were checked for auth, CSRF and logic.
- **Spot-checked:** the scoring engines in `lib/cv-analysis`, which have the best test coverage, and the React pages and components. On the front end I scanned for XSS sinks, open redirects, browser storage and data handling, and confirmed that all 163 API URLs the browser calls map to a route that exists. The UI was **not** reviewed line by line.

**Checks run:**
- `npm run lint`: clean.
- `npm run typecheck`: 73 errors, all in the existing baseline.
- `npm test`: 574/574 passing.
- Finding 1 was confirmed with a throwaway Vitest reproduction (since deleted).

Severity is about impact on customers, money or compliance, not effort to fix. Line numbers are at `2740bd7`.

---

## Fix status

Every finding below is fixed, apart from the two noted under **Not fixed**. Checks after the fixes: lint clean; typecheck 73 errors (the existing baseline, none new); 601 unit tests and 14 end-to-end tests passing; production build passing.

**Before it takes full effect:** apply migration `20261010000000_audit_fixes.sql` (Actions > Apply database migrations). Until then:
- settings saves use the old read-modify-write path;
- the admin Agencies list's "screened this month" still counts candidates;
- the member-move and candidate-merge fixes don't apply.

**Not fixed:**
- **Inbound texts filed under the wrong agency.** This needs a sending number per agency (or per conversation); nothing in the code can tell two agencies' threads apart on one shared number.
- **Firewall auto-blocks that are already permanent.** Auto-blocks now expire after 24 hours by default. An admin who saved the firewall settings while the old default (0, permanent) was in place keeps that choice until they change it on the Security page.

**Also fixed while in the code:**
- a replayed session for an older, ended subscription can no longer replace the current one;
- "own candidates only" also covers the team calendar feed, sharing a shortlist, erasing every record of a person and the Overview's compliance alerts;
- a geocoding outage is no longer cached as "place not found";
- a compliance document is deleted if saving its check fails;
- `/api/run` caps the job description at 50,000 characters.

---

## Summary

| # | Severity | Area | Bug |
|---|---|---|---|
| 1 | **High** | Billing | A cancelled customer can reactivate their subscription for free by replaying their old checkout session id. **Reproduced** |
| 2 | **High** | GDPR | Post-cancellation purge silently deletes nothing for larger agencies, but logs that it did |
| 3 | **High** | Access | Removed team members keep the team interview calendar feed and their BCC filing address, permanently |
| 4 | **High*** | Auth | Clerk sign-up claims any profile with no Clerk id by username alone (legacy accounts, and every deleted member's profile, which still belongs to the agency) |
| 5 | Medium | Availability | One crafted link permanently blocks the clicker's IP (or a whole office) from the entire site, admin included |
| 6 | Medium | Availability | The proxy awaits an un-timed fetch to `/api/internal/edge-log` on every request: a slow database stalls the whole site |
| 7 | Medium | Billing | The Stripe webhook answers 200 when its database write fails, so Stripe never retries (lost activations and cancellations) |
| 8 | Medium | Email | Resend errors are treated as success in 4 places: contact form, demo requests, lead resend, security and health alerts |
| 9 | Medium | Invoicing | Invoice numbering breaks for good after 1,000 invoices. The accounting export silently drops rows past 1,000 |
| 10 | Medium | Email | The bulk-email cap ("400 an hour") counts requests, not emails, so 40,000 an hour are allowed |
| 11 | Medium | Privacy | Public shortlist links leak each candidate's AI score when the agency turned "show score" off |
| 12 | Medium | Permissions | "Financials admin-only" leaks: job fees in the jobs list, job detail and candidate profile; members can edit fees; the weekly digest emails fees to members |
| 13 | Medium | Limits | Monthly screening cap: re-screens bypass it; CSV imports, API-created candidates and applications use it up; applications are refused one early |
| 14 | Medium | Permissions | "Own candidates only" is not applied to saved-search alert emails, merge, job candidate lists, shortlists, compare, interview detail, draft-email |
| 15 | Medium | Data | Candidate paging has no tiebreaker, so the CSV export and pipeline board can duplicate or drop candidates |
| 16 | Medium | Email | Contact form: anonymous HTML injection into the internal email, and `reply_to` is silently ignored |
| 17+ | Low | Various | See the list at the end |

\* Exploitable only where such profiles exist; see finding 4.

---

## High

### 1. A cancelled subscription can be reactivated by replaying the checkout session
`lib/create-profile.js:140-212`, called from `app/api/complete-signup/route.js:72-96`

`linkSubscriptionFromStripeSession` accepts any checkout session that is `paid`/`complete`. It upserts the caller's subscription row with a hard-coded `status: "active"` (line 196). The "already claimed" guard only looks for *other* profiles (`.neq("user_id", profileId)`, line 178). `complete-signup` runs it whenever a `sessionId` is sent, even for an existing profile.

- **Failure:**
  1. A customer subscribes, then cancels in the Billing Portal. The Stripe webhook sets the row to `canceled`.
  2. They `POST /api/complete-signup {"sessionId":"cs_..."}`, using the id from their own `/checkout/success?session_id=` URL.
  3. The row goes back to `active`. Stripe sends no further events for a cancelled subscription, so the paid features stay on forever.
- **Proof:** a Vitest test with a stubbed Stripe session and a `canceled` row gave `linked: true` and `status: "active"`.
- **Fix:**
  - Retrieve the subscription (`stripe.subscriptions.retrieve(session.subscription)`) and store its real `status`.
  - Refuse when the row already has this `stripe_subscription_id`.
  - Only call the link step when the profile has no subscription row yet.

### 2. The GDPR post-cancellation purge fails silently and still logs success
`app/api/cron/data-retention/route.js:25-49, 148-171`

`purgeCandidates` sends every candidate id for the agency in a single `.in()`:
- that is up to 1,000 UUIDs, about 37 KB of URL;
- the codebase itself says this is too long a request (`lib/analytics-data.js:6`, and erasure batches at 200);
- **none of the seven delete calls check for an error.**

The loop then increments `agenciesPurged` and writes an admin audit entry, `retention_purge … candidatesPurged: N`.

- **Failure:** an agency cancelled more than 90 days ago with a few hundred candidates is "purged" every night. Nothing is deleted, CV files included, and the audit log says it was. The DPA Annex C promise is broken and the log is false.
- **Also:** this copy of the logic skips compliance documents and notifications, which `eraseCandidates` handles.
- **Fix:** call `eraseCandidates(supabase, agencyId, ids)` from `lib/candidates/erasure.js`, which batches and stops on errors. Log only what it actually erased.

### 3. Removed members keep the team calendar feed and the BCC address
`lib/member-tokens.js:45-49`, `app/api/calendar/[token]/route.js`, `app/api/webhooks/resend-inbound/route.js:129-161`

`memberForToken` returns `{agency_id, user_id}` for any stored token and never checks that the person is still in that agency. No offboarding path deletes `member_tokens`. That includes:
- `team/invite` DELETE;
- the Clerk `organizationMembership.deleted` webhook;
- `user.deleted`;
- Admin > Agencies "remove member".

Only `move_member_into_agency` deletes them.

- **Failure:** a fired recruiter's subscribed calendar keeps polling `/api/calendar/<token>.ics?scope=team`. Every interview in the agency comes back: candidate names, clients, interviewers and video-call links. Their `log+<token>@` address also still files email onto the agency's candidate timelines.
- **Fix:** in `memberForToken`, join `profiles` and require `profiles.agency_id = member_tokens.agency_id`. Delete the person's tokens in each removal path.

### 4. Sign-up links a new Clerk account to an existing profile by username alone
`app/api/webhooks/clerk/route.js:144-160`, `lib/anonymise-user.js:49-64`

On `user.created`, if any profile has `username = <new username>` and `clerk_user_id IS NULL`, the new Clerk user is attached to it. The check runs **before** `USERNAME_RE` and nothing proves ownership. The comment above it admits usernames can be reused.

Two kinds of profile match:
- **Unmigrated pre-Clerk accounts.** Their usernames are real and guessable, so anyone who signs up with one takes over that profile, its agency and its subscription.
- **Every anonymised ex-member.** `anonymiseDeletedUser` sets `clerk_user_id = null` and `username = "deleted-<first 8 hex of id>"` but **keeps `agency_id`**. A sign-up with that username joins the agency. The `/api/account/delete` comment says this webhook "detaches their profile from the agency"; it doesn't. This one needs the id prefix, and possibly a Clerk username rule that allows `-`.

- **Fix:** link only on a matching verified email (or not at all, now that the migration is done). In `anonymiseDeletedUser`, set `agency_id = null` or use a username Clerk can never issue.

---

## Medium

### 5. One crafted link can permanently block a visitor's IP from the whole site
`lib/security/firewall.js:106-155`, `lib/security/threat-score.js:4`

- The path `/%3Cscript%3E` scores 30 ("xss-probe"), exactly the default auto-block threshold.
- The only safeguard skips requests marked `Sec-Fetch-Site: cross-site/same-site`.
- Links opened from desktop apps (Outlook, Slack, Teams, PDFs) and pasted URLs arrive as `none`.
- The default `autoBlockHours` is 0, so the block is permanent.
- The proxy checks blocks before anything else, so `/dashboard`, `/api` and `/admin` are all refused.

**Failure:** someone emails a customer `https://www.helixon.co.uk/%3Cscript%3E`. One click, and that office's IP is locked out until an admin notices.

**Fix:**
- Don't auto-block on paths a browser can be talked into requesting: block that one request instead of the IP.
- Or require 2+ signals, or default to an expiring block.
- Never apply IP blocks to signed-in admins or customers.

### 6. Every request waits on a database round trip with no timeout
`proxy.ts:221-272`

`await fetch("/api/internal/edge-log")` runs on every page and API request: a second serverless invocation, plus DB queries for blocks, settings, rules and the firewall. It has no `AbortSignal.timeout`. It fails open on *errors*, not on *slowness*: if Supabase is slow, every page and static route hangs with it.

**Fix:** `signal: AbortSignal.timeout(300)` or similar, failing open. Longer term, keep block lists and maintenance state in Redis or Edge Config.

### 7. The Stripe webhook acknowledges failed writes
`app/api/webhooks/stripe/route.js:49, 79`

Upsert and update errors are only logged, and the handler returns `{received: true}` (200). The comment at line 101 says errors must return 500 so Stripe retries, but that only happens for thrown errors.

**Failure:** a DB blip during `checkout.session.completed` means a paid customer is never activated. During `customer.subscription.deleted`, a churned customer is never cut off. Stripe will not retry either.

**Fix:** `throw` on `error` so the existing catch returns 500. Also, `checkout.session.completed` hard-codes `status: "active"` (line 45) even when `payment_status` is `unpaid` (asynchronous payment methods).

### 8. Email failures reported as success
The Resend SDK returns `{ data, error }` and does not throw (`node_modules/resend/dist/index.mjs`, `fetchRequest`). These call sites only use try/catch:

| Call site | Lines | Effect of a failed send |
|---|---|---|
| `app/api/contact/route.js` | 56, 65 | The visitor is told the message was sent |
| `app/api/demo-request/route.js` | 105, 109 | `email_sent` is still set to `true` |
| `app/api/admin/leads/route.js` | 130 | "Resend notification" returns ok and marks the lead emailed |
| `lib/security/alert-email.js` | 24, 57 | Firewall alerts vanish; `sendAdminAlert` returns `true`, so the daily health digest reports "emailed" |

**Fix:** check `error` from each send, the way `lib/mailer.js` already does.

### 9. Invoice numbering breaks after 1,000 invoices
`app/api/placements/[id]/invoice/route.js:30`

The route reads existing invoice numbers with `.limit(10000)` and no `order`. PostgREST still caps the response at 1,000 rows, which the code acknowledges elsewhere (`lib/analytics-data.js:6`). `nextInvoiceNumber` then takes the maximum of an arbitrary 1,000 rows.

**Failure:** once an agency has raised its 1,001st invoice, the next number collides with an existing one. The insert fails with 23505 ("Another invoice took that number") on every attempt, so no further invoices can be raised.

**Fix:** select only the highest number (`order desc`, `limit 1`), or use a per-agency sequence.

**The same silent 1,000-row truncation also affects:**
- `exports/accounting` (lines 32, 45): exports drop invoices and timesheets without warning;
- import de-duplication (`import/route.js` 63, 133, 135, 193): creates duplicates;
- `performance` (`.limit(20000)`): commission and targets computed from partial data;
- `dashboard-ops`, `clients` GET, `team` GET, `email-sequences` stats, `admin/agencies`, `admin/billing`, `employee/ops` KPIs (counts stop at 1,000), `lib/employee/store.js`;
- `sweepAllAgencies`: agencies past 1,000 are never retention-swept.

### 10. The bulk-email cap is 100× too loose
`app/api/emails/send/route.js:23, 58`

`rateLimit(..., MAX_PER_HOUR = 400)` adds 1 per *request*, and each request may send up to 100 emails. One user can send 40,000 an hour from the shared sending domain.

**Fix:** charge one unit per recipient (for example `INCRBY sendable.length`), or check `sendable.length` against what's left of the allowance.

### 11. Shared shortlists leak the AI match score
`lib/client-profile.js:119`, `lib/shortlist-shares.js:59-64`

`buildClientProfile` always includes `score`. `/api/shares/[token]` returns `showScore: false` but leaves the score in every profile, and only the page hides it. Anyone with the link can read the scores in the network tab.

**Fix:** drop `score` from the profiles on the server when `share.show_score` is false.

### 12. "Financials admin-only" is not enforced everywhere

| Where | Lines | Problem |
|---|---|---|
| `lib/job-list.js`, `app/api/jobs/[id]/route.js` | 25; 28 | `select("*")` returns `fee_percent` and `fee_amount` to everyone. The PATCH response does too |
| `app/api/jobs/[id]/route.js` | 188 | Members can set the job fee (`cleanJobDetails`) |
| `lib/candidates/profile.js` | 133 | Returns `job: candidate.jobs(*)`, including fees |
| `app/api/placements/[id]/route.js` | 50 | Members can change salary, fee and rates; they're only hidden when read back |
| `app/api/clients/[id]/route.js` | PATCH | The response returns `feePercent` unredacted |
| `app/api/cron/analytics-digest/route.js` | 148 | Emails "Fees placed" to every opted-in member, whatever the permission says |

### 13. The monthly screening cap is unreliable
- **Re-screens bypass it.** `app/api/candidates/[id]/rescreen` has no `screeningCap` check, but `/api/run` and applications do. This includes bulk re-screens from the talent pool.
- **It counts every candidate row created this month,** not screenings (`lib/agency-controls.js:34`). A CSV import of 500 contacts, API/LinkedIn-extension additions and unscreened applications all use it up.
- **Applications are refused one early.** They are counted *before* screening, so the new row counts against itself: with a cap of 100 and 99 used, the 100th is refused.

**Fix:** count `scores` rows (actual screenings) and check the cap in `rescreenCandidate`.

### 14. "Own candidates only" gaps
Members limited to their own candidates can still see other people's:
- in saved-search alert emails (`cron/saved-searches:34`, no `scopeCandidateQuery`);
- in agency-wide digest figures;
- by merging a hidden record into their own (`candidates/[id]/merge:32` checks only one side);
- in `jobs/[id]/candidates`, `shortlists/*`, `compare`, `interviews/[id]` and `draft-email`, which returns the candidate's email;
- in the linked rows of the subject-access export;
- in the counts from `saved-searches?counts=1`.

### 15. Exports and the pipeline board can duplicate or drop candidates
`lib/candidates/list.js:65`

The list orders only by the chosen column. `match_score` and `stage` have many ties, and null scores sort last. Pages are fetched with `range()` (LIMIT/OFFSET). Postgres doesn't keep tie order stable between queries with different limits (top-N heapsort), so `getAllCandidates`, used by the CSV export, the pipeline board and analytics, can return some candidates twice and leave others out.

**Fix:** add `.order("id")` as a final tiebreaker.

### 16. Contact form email bugs
`app/api/contact/route.js`
- **Line 163:** the preheader is `${topic} - ${message.slice(0, 80)}`, inserted into HTML *unescaped*. An anonymous visitor can put arbitrary HTML (links, fake content) into the email that support receives. `topic` is also free text, not limited to the three choices.
- **Line 59:** `reply_to: email` is ignored. The SDK only reads `replyTo`, so replying to a contact-form email goes to `contact@`, not the person who wrote in.

---

## Low

**Access, billing and lifecycle**
- `/api/dashboard-stats` and the dashboard home page use `getCustomerContext()`, so a **suspended** workspace still gets its candidate list there (`app/api/dashboard-stats/route.js:9`, `app/dashboard/page.js:12`).
- `cron/sequences`:
  - It keeps emailing after a subscription lapses, because it never checks one.
  - Suspended agencies' rows are filtered out *after* `.limit(300)` and never claimed. They stay at the head of the queue and can starve every other agency (line 44).
- Admin "grant demo access" upserts over a **paying** customer's row and sets `stripe_subscription_id = null` (`admin/users/route.js` `grantDemoAccess`). Later Stripe webhooks then match nothing.
- Invoice status changes are unrestricted (`invoices/[id]/route.js:42`). Void puts the timesheets back to approved, and un-voiding doesn't take them back, so they can be billed twice.
- The race between "already invoiced" / "already sent" checks and the insert or send can double-invoice or double-send (`placements/[id]/invoice`, `send-email`).
- `move_member_into_agency` only blocks on `status = 'active'`. A `past_due` (still paying) workspace can be moved and deleted.

**Data**
- `merge_candidates` copies `talent_pool_at` but not `talent_pool_expires_at` (`…signatures_portal_booking_merge.sql:203`). The merged record is in the pool forever and is never retention-erased.
- Import de-duplication compares emails case-sensitively (`.in("email", …)`, `import/route.js:58`), so `John@X.com` already on file is imported again as `john@x.com`.
- `cron/geocode` writes `geocode_query` even when the lookup failed (for example a provider outage), so those candidates are never retried.
- `GET /api/interviews` with no date range returns the **oldest** 500.
- Agency `settings` JSON is read, modified and written by six routes, so two simultaneous saves lose one change.
- Inbound texts are filed under whichever agency texted that number last. That is the wrong agency when two agencies text the same candidate.

**Robustness and security hardening**
- `book/[token]` POST: `new Date("junk").toISOString()` throws, giving a 500 (line 58).
- In maintenance mode, if `SITE_GATE_SECRET` is unset, any request with a four-part `helixon_dev_unlocked` cookie throws inside the proxy, giving a 500 (`proxy.ts:309`).
- Webhook delivery checks DNS and then lets `fetch` resolve the host again, which leaves a DNS-rebinding window (`lib/webhooks.js:93-98`).
- The Sentry tunnel `/monitoring` goes through the proxy. Every error report costs an edge-log call and is redirected during maintenance; Sentry's own config warns against this.
- The password-change handler sits at `/api` (`app/api/route.js`) instead of `/api/account/password`, and nothing calls it.
- `draft-email` returns raw `error.message` on a 500 and has no rate limit.
- Admin GET routes refresh the sliding session, so an auto-refreshing admin page never reaches the idle timeout.

**Privacy (browser)**
- Recently viewed candidate, job and client names (`helixon.recent`, `components/dashboard/NavTools.jsx:18`) are not in `clearLocalCandidateData`'s list (`lib/clear-local-data.js:4`). They survive sign-out on a shared computer.

---

## What held up
- **Tenant isolation.** I did not find any query that reads another agency's data. Every agency-table query carries `agency_id`, and child rows are reached through a checked parent. The `.or()` filters quote user input.
- **Admin auth.** HMAC session with idle and absolute expiry, per-user kill switches, TOTP with a replay guard, double-submit CSRF on every mutating route, generic error messages.
- **Webhooks.** Every one verifies its signature (Stripe, svix for Clerk and Resend, Twilio HMAC), comparing in constant time.
- **Token links.** 192-bit random tokens, expiry, and atomic single-use updates (`eq("status", …)`).
- **Front end.** A strict nonce CSP, JSON-LD escaped, and no `dangerouslySetInnerHTML` on user data.
- **Integrations.** OAuth state cookies bound to provider, user and workspace. Tokens are sealed with AES-GCM, and the refresh keeps the old refresh token.
