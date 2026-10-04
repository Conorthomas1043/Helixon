# Helixon: architecture

How the app in `helixon-app/` fits together. Read this before changing auth, data access or anything that runs on a schedule.

## The stack

| Layer | What | Where |
|---|---|---|
| Web app | Next.js (App Router), React 19, Tailwind v4 | `app/`, `components/` |
| Hosting, crons | Vercel | `vercel.json` |
| Customer sign-in | Clerk (users and organisations) | `proxy.ts`, `lib/customer-auth.js` |
| Data | Supabase Postgres, reached with the **service-role** key | `lib/supabase.js`, `supabase/migrations/` |
| Billing | Stripe Checkout and webhooks | `lib/stripe.js`, `app/api/webhooks/stripe` |
| Email | Resend (outbound, and inbound for BCC logging) | `lib/mailer.js`, `app/api/webhooks/resend-inbound` |
| SMS, calls | Twilio | `lib/sms.js`, `app/api/webhooks/twilio` |
| AI | Anthropic (extraction, judging), Voyage (embeddings), Gemini | `lib/cv-analysis/` |
| Rate limits, sessions cache | Redis | `lib/redis.js`, `lib/ratelimit.js` |
| Errors, performance | Sentry (`lib/report-error.js` for handled errors), Vercel Speed Insights | `instrumentation*.js`, `sentry.*.config.js` |
| Product analytics | PostHog, only after cookie consent | `instrumentation-client.js`, `lib/analytics.js` |

## Who uses it, and how each is authenticated

| Area | People | Auth | Guard used in API routes |
|---|---|---|---|
| `/dashboard`, `/analyse`, `/account`, `/billing` | Agency members | Clerk session, checked in `proxy.ts` | `requireCustomerContext()` (`lib/customer-auth.js`). It returns the member's `agencyId`, role and subscription state |
| `/admin` | Helixon staff (operators) | Own username/password + TOTP, signed session cookie, double-submit CSRF token. The login can be moved to a secret path with `ADMIN_LOGIN_SLUG` | `requireAdminSession()` (`lib/admin-auth.js`) |
| `/employee` | Helixon staff (sales/ops) | Own bcrypt credentials, sessions in `employee_sessions` | `employeeAccess()` (`lib/session.js`, backed by `lib/employee-auth.js`) |
| `/share`, `/scorecard`, `/portal`, `/book`, `/sign`, `/reference`, `/feedback` | Clients, candidates, referees, with no account | An unguessable token in the link | Token lookup in each route |
| `/api/v1/*` | Customer integrations | API key (`lib/api-keys.js`) | `lib/api-v1.js` |
| `/api/cron/*`, `/api/internal/*` | Vercel Cron, the edge proxy | Bearer secret, compared in constant time (`lib/timing-safe.js`) | |
| `/api/webhooks/*` | Clerk, Stripe, Resend, Twilio | Provider signature (svix, Stripe, Twilio HMAC) | |

`proxy.ts` (Next's middleware) runs first on every request. It applies Clerk, the maintenance switch, the admin gate, cross-site request rejection (CSRF by `Origin`/`Sec-Fetch-Site`) and request logging. Security headers and the Content-Security-Policy are set in `next.config.mjs`.

## Tenant isolation (read this before writing a query)

Server code uses the Supabase **service-role** client, which bypasses row-level security. RLS is switched on for every table with no policies, so the browser can't reach the database directly. That does not separate one agency from another: **the API code does that**.

The rules:
1. Get `agencyId` from `requireCustomerContext()`, never from the request body or query string.
2. Every query on an agency-owned table carries `.eq("agency_id", agencyId)`.
3. A child row (a note, an activity entry) may be reached by its parent's id only after the parent was loaded with the agency filter.
4. Within an agency, `lib/permissions.js` decides what a member may see (for example, recruiters limited to their own candidates).

`lib/security/tenant-isolation.test.js` enforces rule 2 as a ratchet: it fails if any API file gains an unfiltered query on an agency table. Crons, webhooks, admin tools and token links are in its baseline because they legitimately work across agencies.

A second, independent check sits in the database: customer API routes run their agency-table queries through `agencyDb()` (`lib/agency-db.js`). When `SUPABASE_AGENCY_RLS=1`, that client uses a short-lived JWT the server signs for the `agency_member` role with the member's `agency_id`, and the policies from migration `20261005000000_agency_member_rls` only show or accept that agency's rows. Browsers can't get such a token, so `anon` and `authenticated` still have no access through the REST API. `supabase/agency-rls.test.js` runs the migration on a real Postgres engine (PGlite) and checks the isolation. How to switch it on is in the runbook.

## CV screening pipeline

`app/api/run` receives CVs and a job, then calls `lib/cv-analysis`:
1. **Extraction** (`extraction/`, `lib/document/` for PDF/DOCX): text, then structured fields via the AI model.
2. **Scoring** (`scoring/scoreCandidate.js`): separate engines for evidence, gaps, knockouts, progression, salary, certifications, industry, semantic and embedding match, and an AI "fit judge". Weights are fitted by `npm run calibrate`.
3. **Explanation** (`explainabilityEngine.js`, `interviewQuestions.js`): the evidence quotes and interview questions shown in the report.
4. **Blind screening** (`blindRedaction.js`) removes identifying details before scoring when the agency asks for it.

Results are stored in `scores`, and the candidate record in `candidates`. The pipeline has the best test coverage in the repo (`lib/cv-analysis/tests`), plus evaluation scripts (`npm run eval:*`).

## Scheduled jobs

Defined in `vercel.json`, all under `app/api/cron/` (times are UTC):

| Job | When | Does |
|---|---|---|
| `data-retention` | 03:00 daily | Deletes data past its retention period (GDPR) |
| `admin-daily` | 03:30 daily | Health snapshot and admin digest |
| `geocode` | 02:40 daily | Fills in locations for distance search |
| `integrations` | 04:25 daily | Syncs connected mailboxes, calendars and accounting tools |
| `reminders` | 06:50 weekdays | Follow-up and interview reminders |
| `saved-searches` | 06:35 weekdays | Alerts for new matches on saved searches |
| `sequences` | 08:20 daily | Sends the next step of email sequences |
| `analytics-digest` | 07:10 Mondays | Weekly analytics email |

## Code layout

- `app/`: routes. `app/api/` holds the 200 or so route handlers. Each area has an `error.js` boundary (`components/RouteError.jsx`).
- `components/ui`: the UI kit, the one set of building blocks for every screen: `Button`, `Card`, `Field` and inputs, `Switch`, `Segmented`, `Notice`, `Dialog` (focus-trapped), `EmptyState`, `ErrorState`, `Pill`, toasts and icons. Colours come from the `--ui-*` tokens in `app/globals.css`, which the admin console redefines for its dark theme (`app/admin/_shared/styles.js`). Each area's `ui` module (`components/dashboard/ui`, `app/analyse/_components/ui`, `components/account/ui`, `app/employee/_shared/ui`, `app/admin/_shared/ui`) re-exports it and adds only that area's own layouts. `/ui-gallery` shows every component in both themes when `UI_GALLERY=1` is set. `components/dashboard/use-confirm.jsx` replaces `window.confirm`.
- Loading data on the server: the candidate profile (`app/dashboard/candidates/[id]/page.jsx`) loads with `lib/candidate-profile.js`, the same loader `GET /api/candidates/[id]` uses, and hands it to the client component, which only fetches again on retry. Its panels live in `_components/`. New pages should follow this pattern.
- `lib/`: business logic, mostly pure functions with tests next to them (`*.test.js`).
- `app/globals.css`: design tokens (`--forest`, `--ink-*`, score colours, radii, shadows), mapped into Tailwind's theme.
- `supabase/migrations/`: the schema history, applied with the "Apply database migrations" workflow (see the runbook).
