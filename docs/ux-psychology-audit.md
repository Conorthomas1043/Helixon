# Helixon: product-wide UX, psychology & conversion audit

**Scope:** the whole customer journey, from first visit to renewal. That covers the marketing site, pricing and checkout, signup, first-run, the core analyse workflow, the dashboard, collaboration, billing and failed payments, candidate-facing pages (job ads, applications), lifecycle email, analytics instrumentation, accessibility and performance.

**Method:** we read the code and traced each journey end to end (the routes, the APIs they call, and the copy along the way). Fixes were checked with lint, the existing test suite (85 files, 481 tests), a production build, and screenshots from that build at 1280px and 390px. Internal staff consoles (`/admin`, `/employee`) were only spot-checked.

**Severity:** **P0** loses money, data or trust. **P1** clear conversion, activation or retention loss. **P2** friction or polish.

---

## Executive summary

Helixon's engineering quality is high. Accessibility, reduced motion and honest copy are clearly deliberate in many places, and the core analyse flow is well designed. The biggest problems weren't in any single screen but at the joins between them:

1. **A failed payment looked like "you were never a customer"** (P0, fixed). One declined renewal immediately blocks screening. Customers were then sent to the sales page and invited to buy a new plan, with no mention that a payment had failed.
2. **Deleting a candidate: "Cancel" still deleted** (P0, fixed). A native OK/Cancel box used Cancel to mean "remove from this job only".
3. **Claims that contradicted the product or each other** (P0, fixed): "94% match accuracy" and "10x faster" with no data behind them, "scanned and photographed CVs" (not supported), "EU servers" vs Switzerland, 30 seconds vs a minute, "Most popular", and "you must sign in before checkout" (false).
4. **A brand-new account opened on a dashboard of zeros** (P1, fixed). The one useful action sat below the fold.
5. **Too little instrumentation to manage growth** (P1, mostly fixed). There were 7 product events, no account-level analytics, and identification broke for anyone who accepted cookies after the page had loaded.
6. **No lifecycle email at all** (P1, recommended). There's no welcome email and no activation nudge. A welcome template exists but nothing sends it, and its copy still promises "3 free analyses".

---

## Macro findings (journeys and systems)

### M1. Failed payment → locked out → told to buy again · P0 · Fixed (copy and flow), policy decision open
*Lenses: retention, behavioural economics, UX writing*

- `lib/subscription-status.js` grants access only while a subscription is `active`. When a renewal fails, Stripe marks it `past_due` and keeps retrying, but Helixon blocks screening straight away.
- The next screening attempt returns 402 and redirects to `/pricing?reason=subscription_required`. `/pricing` ignored `reason` and showed "Choose Individual". The billing page could show "You're not on a paid plan yet → View plans".
- **Risk:** customers who are owed help either churn, or buy a second subscription that double-bills them once the card is fixed.
- **Fixed:**
  - `/pricing` now explains, when that reason is present, that the cause is probably a failed renewal, and links to Billing and Contact.
  - Billing shows a red "Your last payment didn't go through" alert with an "Update payment method" button. It says what's paused (screening and email) and that all data is safe.
  - Portal opens are now tracked.
- **Decision for you:** most SaaS products keep access through Stripe's retry window, a grace period of roughly 1–2 weeks. Adding `past_due` to `ACCESS_STATUSES` is a one-line change. Admin Billing already counts `past_due` as paying. The site should also show a "payment failed" banner on every page, not only on Billing (`/api/auth/me` would need to return the subscription status).

### M2. Activation: first-run experience · P1 · Fixed
*Lenses: behavioural science (goal-gradient, endowed progress), UX*

- **Before:** a new workspace landed on 5 zero-value KPI cards, "Risks: all clear" and "Nothing booked". "No candidates yet → New analysis" sat below them.
- **Now:** a **Getting started** checklist appears at the top for any workspace that hasn't screened anything.
  - "Set up your workspace" starts ticked, because it's already true (endowed progress).
  - Then: **Screen your first CV** (primary), Add a job, Import existing candidates, and Invite your team (Agency plan only).
  - It shows "x of y done" with a progress bar. The zero KPIs, risks and agenda are hidden until there's something to show, and the checklist disappears after the first screening.
- Clicks on each step are tracked (`onboarding_step_clicked`).
- **Next:** define activation as "first analysis within 24h of `workspace_created`" and watch it as a PostHog funnel.

### M3. Analytics and identity · P1 · Mostly fixed
*Lenses: product analytics, UX analytics, growth*

| Gap | Fix |
|---|---|
| 7 events in total; no failures, bulk runs, jobs, invites or shares | Added `workspace_created`, `analysis_failed` (with status), `bulk_analysis_started` / `_finished` (succeeded and failed counts), `job_created`, `teammate_invited`, `shortlist_shared`, `onboarding_step_clicked`, `demo_form_started`, `billing_portal_opened` |
| `identify` only ran if PostHog was already running when the nav mounted, so anyone accepting cookies after load stayed anonymous | `useAnalyticsIdentity` runs again when consent arrives |
| No account-level view (the customer is the agency) | `posthog.group("agency", id, { name, plan })`; `/api/auth/me` now returns `agencyId` |
| Every caller had its own copy of `posthog.__loaded` checks | `lib/analytics.js` `track()` |

**Still open:**
- Server-side events for things that don't pass through a browser: `subscription_started`, `payment_failed`, `subscription_cancelled` from the Stripe webhook (needs `posthog-node`).
- A cancellation-reason survey before the Stripe portal.
- Saved PostHog funnels: visit → demo/checkout → workspace → first analysis → 5th analysis → teammate invited.

### M4. Lifecycle email · P1 · Recommended
`emails/WelcomeEmail.jsx` is never imported, and its copy describes a free-trial model that no longer exists ("3 free analyses… no card"). After paying, a customer gets a Stripe receipt and nothing from Helixon.

**Recommended sequence:**
1. **Welcome** right after `workspace_created`: one CTA, "Screen your first CV".
2. **Day 2, if no analysis yet:** "Here's a 60-second way to try it", with a sample CV and role.
3. **After the 1st analysis:** "Next: add the whole batch" (bulk upload).
4. **Agency plan, only one member after 7 days:** "Invite your team".
5. **Dunning:** "Payment failed" with a link to update the card. Stripe can send this, but the copy should be on-brand.

I didn't wire this up, because it sends email to real customers and needs your sign-off on the sender address and copy.

### M5. Trust and claims consistency · P0 · Fixed
*Lenses: direct-response, compliance (UK CAP code), credibility*

| Where | Problem | Now |
|---|---|---|
| Login panel | "94% match accuracy", "10x faster screening", nothing to back them | "<1 min per CV", "50 CVs per bulk upload", "∞ analyses/month" |
| Home features | "scanned and photographed CVs" (image-only files fail extraction) | "PDF and Word CVs, tables and columns included" |
| How it works, FAQ | "EU servers" (the DPA says Switzerland) | Switzerland, consistently |
| How it works, FAQ | "30 seconds" | "Under a minute per CV" |
| `/pricing` | "Most popular" (no data) | "Recommended for agencies" |
| `/pricing` | "You must be signed in before checkout" (false, guest checkout works) | "No account needed first" |
| Pricing copy | "Team access", with no size | "Up to 5 team members", from one shared constant that the seat limit enforcement also uses |

### M6. Pricing and purchase psychology · P1 · Fixed
- Positive framing ("Unlimited screening on both plans…").
- Risk reversal under each button ("Billed monthly · Cancel anytime").
- A demo option for people who aren't sure yet.
- An objections block next to the price.
- Buttons line up across the two plans.
- One shared checkout helper (the two copies had drifted, and one crashed on non-JSON errors).

**Open decisions:** an annual plan to anchor the monthly price, and a first-month money-back guarantee instead of a trial.

### M7. Demo funnel · P1 · Fixed
- A "What happens next" panel: reply within one business day, run on your own CVs, no obligation.
- A benefit-led headline.
- Errors shown under the field they apply to, with ARIA.
- No auto-focus on phones (it popped the keyboard over the page).
- Focus moves to the confirmation after submitting, which also offers a next step.
- `demo_form_started` makes form abandonment measurable.

### M8. Candidate experience (the agency's own funnel) · P1 · Partly fixed
Candidates applying through an agency's job page are that agency's conversion funnel, so a bad experience here costs the agency, and indirectly Helixon.

**Fixed:**
- An "Apply for this job" button at the top. On a phone the form used to sit below the full description.
- CV size and type are checked before upload. A 15 MB file used to upload completely and only then fail.
- The confirmation now names the email address they'll be contacted at and suggests checking spam. The old line, "we'll be in touch if you're a match", reads as "probably not".

**Recommended:** an acknowledgement email to applicants. Right now nothing confirms receipt, so the confirmation screen is their only record.

### M9. Destructive actions and confirmations · P0/P1 · Fixed
- **P0:** on the candidate profile, deleting someone with other records used `confirm()` with OK = erase everything and Cancel = remove from this job, so pressing Cancel still deleted.
  - It's now a dialog with three explicit buttons: "Remove from {job} only", "Erase all N records", "Cancel".
  - The body explains GDPR erasure.
  - Focus starts on Cancel.
- All other native `confirm()` calls in the customer dashboard (deleting a tag, bulk erase, bulk remove from the talent pool, making someone admin) now use the same `useConfirm()` dialog, with specific button labels ("Erase 3 candidates", not "OK").
- The `Dialog` primitive now returns focus to the element that opened it.
- **Left as is:** the "screened blind, open the CV anyway?" prompt. It's a privacy speed bump that only opens a file. The employee portal (internal) still uses `alert()` and `confirm()` in places, even though it has its own Toaster.

---

## Micro findings

| # | Area | Issue | Status |
|---|---|---|---|
| 1 | Signup | Agency-name input had no programmatic label | Fixed (`useId` + `htmlFor`) |
| 2 | Signup | The primary button's resting (disabled) state was white on `--ink-mute`, 1.83:1 contrast, and looked broken | Fixed (dimmed brand colour) |
| 3 | Signup | Copy named the auth vendor ("Clerk keeps this part secure") | Fixed |
| 4 | Signup | "Magnetic" button ignored reduced-motion settings | Fixed |
| 5 | Dashboard | `Button size="sm"` was ~22px tall, under the WCAG 2.2 minimum target size of 24px | Fixed (28px min; md 32px) |
| 6 | Dashboard | 10px uppercase grey labels on every KPI and section heading | Raised to 11px on Overview; about 140 other `text-[10px]` uses remain (mostly dense tables) |
| 7 | Analyse | "Compare with another CV" next to "Compare for this role" | Now "Upload a CV to compare" / "Compare everyone for this role" |
| 8 | Analyse | 5 equal-weight actions on the report toolbar (Hick's law) | Recommended: keep "Next candidate" primary and move Re-score and Compare into a "More" menu |
| 9 | 404 | Primary button "Go to the app" sent visitors with no account to a login screen | Primary action now depends on whether the visitor is signed in |
| 10 | Checkout | "We couldn't confirm that payment" offered no human contact | Contact link added |
| 11 | FAQ | Accordion: closed answers were read by screen readers, and long answers were clipped at 200px | Fixed; FAQPage JSON-LD added |
| 12 | Home / pricing | Loading button text unreadable (1.83:1) | Fixed |
| 13 | Fonts | A Google Fonts stylesheet blocked rendering on every page; Fraunces loaded site-wide | Self-hosted with `next/font` and size-matched fallbacks |
| 14 | Lint | Existing errors in `/pricing`, `/billing`, `/404` | Fixed in the files touched; existing `react-hooks` errors in the dashboard pages (no new ones) and in the legal pages remain |
| 15 | Copy | 32 generic "Something went wrong" fallbacks | Acceptable where paired with a retry; worth replacing on the analyse and apply paths with cause-specific messages |

---

## Recommendations backlog (ranked by impact ÷ effort)

| Rank | Item | Lens | Effort |
|---|---|---|---|
| 1 | Decide on a `past_due` grace period and add a site-wide failed-payment banner | Retention | S |
| 2 | Welcome and activation emails (M4) | Lifecycle | M |
| 3 | Real testimonials or logos near the hero and pricing (never invented) | Social proof | S (content) |
| 4 | Stripe webhook → PostHog server events; saved activation and retention funnels | Analytics | M |
| 5 | Acknowledgement email to job applicants | Candidate experience | S |
| 6 | Cancellation-reason survey before the Stripe portal; offer a pause or downgrade to Individual | Retention | M |
| 7 | Annual plan and/or money-back guarantee | Pricing | S (decision) |
| 8 | Interactive "try one sample CV" on the homepage, before an email is asked for | Conversion | L |
| 9 | Toolbar simplification on the analysis report (micro #8) | UX | S |
| 10 | Move dashboard aggregation to the server (the client gets every analysis and computes KPIs; `truncated` already shows the ceiling) | Performance | M |
| 11 | Homepage as server components (all ~1,300 lines currently ship as client JS) | Performance / SEO | M |
| 12 | Replace `alert()` and `confirm()` in the employee portal with its existing Toaster | Internal UX | S |

---

## Verification
- `vitest`: 85 files, 481 tests passing.
- `eslint`: no new errors in any changed file. Existing errors were removed from `/pricing`, `/billing` and `/404`. Existing `react-hooks` errors in the large dashboard pages are unchanged (the counts are identical before and after).
- `next build --webpack` succeeds.
- Production-build screenshots checked: home, `/pricing` (normal and lapsed), `/demo` (desktop and phone), `/faq`, 404, login.
- Not checked visually: the signed-in screens (dashboard checklist, confirmation dialogs, billing alert), because they need a live Clerk session and database.
