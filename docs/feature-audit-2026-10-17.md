# Helixon: feature audit

**Date:** 17 October 2026 · **Scope:** `helixon-app` at `ac5024c`: every customer-facing feature, the public site, sign-up and Helixon's own billing.

**Rating:** wide and mostly well built, with a handful of serious gaps.

## Summary

**What's strong.** For an agency CRM Helixon covers a lot of ground: screening, the pipeline, jobs and careers pages, clients, interviews, placements, invoicing, e-signatures, email, SMS and analytics. Most of it is complete rather than stubbed. No agency can see another agency's data, cron and admin routes are locked down, and the unit tests pass.

**What should be fixed before more sales:**
- **Candidate data loss:** a migrated database can be erased the night it's imported.
- **Candidate data exposure:** bulk-screening CVs stay on shared computers after sign-out, and blind screening leaks identity.
- **Email law (PECR):** bulk email and sequences have no unsubscribe.
- **Billing:** a customer can be charged twice.
- **Website promises:** some claims on the site don't match the product.

This audit sits alongside the earlier bug, security, code-quality and UX audits in `docs/`. Those looked for defects and risk. This one asks what each feature does, how finished it is, and what an agency would miss next to Bullhorn, Vincere, Recruit CRM, Loxo or Manatal. Where it finds new defects, it lists them.

## How this was done

- **Read by area.** Six product areas were each read in full, at the code level:
  - screening and AI
  - candidates and the pipeline
  - jobs, clients and interviews
  - money, billing and reporting
  - messaging, team and integrations
  - the public site and onboarding
- **Defects traced, not guessed.** Every defect below is traced from an input to a failure, with file references.
- **Eleven findings checked a second time.** These were the most serious, and all eleven were confirmed by reading the code again: High 1–4, 6–9 and 11, Medium 8, and the FAQ deletion claim.
- **Tests run.** Every area's unit tests pass: about 700 tests across 112 files.
- **What wasn't done.** Nothing was run against live Stripe, Clerk, Resend, Twilio or the AI providers, and production environment settings weren't checked. Findings that depend on hosting (function timeouts, request size limits) are marked as such.

## Feature map

Status, per feature:
- **Complete:** works end to end.
- **Partial:** works, with a real gap.
- **Stub:** placeholder.
- **Missing:** an agency would expect it and it isn't there.

### Screening and AI

| Feature | Status | Note |
|---|---|---|
| Screen one CV, report, view CV, sample CV | Complete | Streams real progress; the report quotes the CV line behind each skill |
| Bulk screening (up to 50) | Complete | Live leaderboard and resume, but see High 3 |
| Compare 2–4 candidates | Complete | Server returns identity for blind candidates (Medium 1) |
| Re-score | Partial | Re-uploads and creates a duplicate candidate (Medium 4) |
| Rescreen against another job | Complete | Reuses stored CV text |
| CV reading | Partial | PDF and .docx only: no OCR, no .doc, no images |
| Blind screening | Partial | Leaks past employers and achievement lines (Medium 1) |
| AI-writing check, score feedback | Complete | Feedback is collected but only used for offline calibration |
| AI email drafts, call-note summaries | Complete | |
| Public API (`/api/v1`) | Partial | CRUD for candidates, jobs, clients, placements and webhooks; no screening, no API reference page |
| In-app AI assistant | Missing | `/api/assistant` is the marketing site's chatbot, not a recruiter tool |

### Candidates and pipeline

| Feature | Status | Note |
|---|---|---|
| List, boolean search, radius, filters, bulk actions | Complete | Boolean search capped at 100 characters |
| CSV export | Partial | Built in the browser, silently capped at 20,000 rows, no contact columns, not audited |
| Saved searches with daily alerts | Complete | |
| Profile, notes, call notes, timeline, documents, custom fields, merge | Complete | |
| Pipeline board | Complete | Loads every candidate; no rejection-reason prompt |
| Talent pool, tags, follow-ups | Complete | Talent pool silently stops at 2,000 people |
| Import (Bullhorn and Vincere header mapping) | Complete | But see High 1 |
| Compliance and right-to-work checks | Complete | No expiry reminder emails |
| References | Complete | |
| Privacy: retention, erasure, subject access export | Partial | Gaps in erasure and the export (Medium 7); no request log or deadline tracking |
| Client shortlists and share links | Complete | Blind shares show the raw recruiter note (Medium 2) |
| Candidate self-service portal | Complete | No consent withdrawal or erasure request |

### Jobs, clients and interviews

| Feature | Status | Note |
|---|---|---|
| Jobs: create, edit, owner, fee, fill-by date | Complete | Editing must-haves doesn't change scoring (Medium 3) |
| Careers pages, applications, consent | Complete | Applications go to the job's creator, not its owner (Medium 8) |
| Advertising | Partial | Tracked links, an XML feed and Google for Jobs markup; no posting to job boards |
| Clients, contacts, terms, timeline | Complete | |
| Client portal | Missing | Clients only get one-off token links |
| Business development deals | Partial | Board and weighted pipeline; won deal can't be turned into a job from the UI |
| Interviews, invites, self-booking | Complete | No double-booking check; invites expose emails (Medium 9, 10) |
| Scorecards | Partial | Fixed criteria; no custom templates per job |
| Calendar | Partial | Read-only ICS feed; no two-way sync for recruiters |

### Money, billing and reporting

| Feature | Status | Note |
|---|---|---|
| Offers, placements, split fees | Complete | |
| Rebate periods | Partial | A date and an alert; no refund or replacement workflow |
| Timesheets | Partial | Internal approval only; no client or contractor portal |
| Invoices: raise, number, VAT, paid/overdue/void | Complete | Print-to-PDF only; can't be emailed from Helixon |
| Xero and QuickBooks | Partial | Always sends the 20% VAT code (Medium 13); exports always the full history |
| E-signatures | Complete (basic) | One signer, typed name, hash, IP and user agent |
| Helixon subscription billing | Complete, with defects | High 6 and 7 |
| Analytics, performance, targets, commission | Complete | Figures disagree between pages (Medium 12) |

### Messaging, team and integrations

| Feature | Status | Note |
|---|---|---|
| Bulk and merge email, templates | Complete | Plain text only; no unsubscribe (High 4) |
| Sequences | Partial | Don't stop on reply without extra setup (High 5); 300 sends a day across the platform (Medium 15) |
| Gmail and Outlook | Partial | Read-only, one-way sync; can't send from the user's own mailbox |
| SMS | Complete | Shared Twilio number misroutes replies (Medium 16) |
| WhatsApp, calls | Partial | `wa.me` and `tel:` links plus a manual log |
| Notifications bell | Complete | One person reading a team notification clears it for everyone |
| Team, roles, permissions | Partial | Owner, admin, member, plus two switches; no custom roles or SSO |
| Outbound webhooks | Partial | Signed and SSRF-safe, but one attempt, no retries, no delivery log |
| Scheduled jobs (8) | Complete | All scheduled and secret-protected |

### Public site and onboarding

| Feature | Status | Note |
|---|---|---|
| Homepage, pricing, how it works, FAQ | Complete | Some claims are false (see below) |
| Checkout and post-checkout sign-up | Complete | Pay-twice trap (High 10) |
| Legal pages | Partial | Thorough privacy notice; thin terms; no company details |
| Blog | Stub | Six "coming soon" cards; not linked anywhere |
| Account deletion, cookie consent | Complete | No self-serve data export |
| `/rate-limited` | Broken | Redirect loop for blocked visitors (High 11) |

## Fix first: High

1. **An import can be erased the same night.**
   - **How it happens:**
     - The import maps "Date Last Modified" and "Last updated" to `last_activity_at` (`lib/candidates/import-mapping.js:23`) and stores it as-is (`app/api/import/route.js:123`).
     - The 03:00 retention sweep erases anyone not in the talent pool whose `last_activity_at` is older than the retention period (`lib/compliance/data-retention.js:15-22`). The default is 12 months, and the limit is 2,000 per agency per night.
     - The 30-day warning only covers people approaching the cutoff, not people already past it.
   - **Example:** an agency migrating from Bullhorn loses everyone not touched in the past year.
   - **Fix:** don't let an imported date start the retention clock (store it separately, or use the import date), or warn on the import page and default old records to the talent pool.
2. **A removed teammate's mailbox keeps syncing.** Removing a member detaches their profile and revokes calendar tokens (`app/api/team/invite/route.js:322-336`), but leaves their `integration_connections` row. The nightly sync (`app/api/cron/integrations/route.js:24-47`) keeps reading their Gmail or Outlook into the old agency. They can't disconnect it, because they no longer have access.
3. **Bulk-screening CVs stay on shared computers.**
   - The bulk run saves CV files to IndexedDB under one key, with no user or agency binding and no expiry (`app/analyse/_lib/bulkRun.js`).
   - Sign-out doesn't clear it (`lib/compliance/clear-local-data.js`).
   - The next person to sign in on that browser is offered "Pick up where it stopped" and can screen another agency's candidates into their own workspace.
4. **No unsubscribe on bulk email or sequences.** UK PECR requires an opt-out on marketing email.
   - No `List-Unsubscribe` header, no opt-out link and no suppression list anywhere. The blog admits it (`app/blog/page.jsx:204`).
   - A candidate who asks to stop can be emailed again straight away.
5. **Sequences keep sending after a reply.**
   - Only the Resend inbound webhook stops an enrolment (`app/api/webhooks/resend-inbound/route.js:90-95`).
   - Without `RESEND_INBOUND_DOMAIN` set, replies go to the recruiter's own inbox. They're filed by mailbox sync, which never touches `sequence_enrollments` (`lib/messaging/email-filing.js:54-85`).
6. **A second checkout bills twice.**
   - `/api/checkout` doesn't check for an existing subscription.
   - The webhook's upsert on `user_id` (`app/api/webhooks/stripe/route.js:49-58`) replaces the stored subscription id, so the first subscription keeps billing in Stripe unnoticed.
   - Example: an Individual customer who clicks "Choose Agency" pays for both.
7. **Out-of-order Stripe events can reactivate a cancelled plan.** Subscription updates write `sub.status` straight from the event (`app/api/webhooks/stripe/route.js:78-91`), with no ordering check and no re-fetch. A delayed "active" update landing after "deleted" turns access back on.
8. **Optional requirements are reported as met without being checked.** `applyKnockouts` skips non-required rules (`lib/cv-analysis/scoring/knockoutEngine.js:238`), and the report then marks them "met" (`lib/cv-analysis/scoring/scoreCandidate.js:467-479`). A candidate with no degree gets a green tick for "Degree or equivalent".
9. **Interview invites expose the candidate and client to each other.** One `.ics` listing every attendee is sent to all of them (`lib/interviews/invites.js:51-64`). The candidate gets the hiring manager's email and vice versa, which invites back-door hires.
10. **A paid customer can be told to pay again.** The flow:
    - A guest pays with one email address, then signs up with a different one.
    - The Clerk webhook refuses to create the workspace (`app/api/webhooks/clerk/route.js:184-187`).
    - The setup screen's main button is "Choose a plan" (`components/dashboard/AccountSetupGate.jsx:80-97`).
11. **Blocked visitors hit a redirect loop.** `/rate-limited` isn't exempt from the IP-block check (`proxy.ts:28`, `184`, `297`), so a blocked browser redirects to it forever. Its "Contact support" link is blocked too.

Items 8 and 9 are rated High here because they reach outside the agency: a client sees a candidate's address, a recruiter trusts a tick that was never checked.

## Medium

**Screening**
1. **Blind screening leaks identity.**
   - Only the current employer and the exact full name are redacted (`lib/cv-analysis/scoring/blindRedaction.js:39-49`).
   - Past employers stay in the text the AI scores, and raw achievement lines ("Grew sales 30% at Tesco") are shown as "What stands out" (`scoreCandidate.js:447-452`).
   - `/api/compare` returns name and company for blind candidates; only the browser hides them.
2. **Blind shortlist shares show the recruiter's note unredacted** (`lib/clients/shortlist-shares.js:65`).
3. **Editing a job's must-haves doesn't change scoring.** The job page writes `required_skills`; scoring reads `jobs.parsed`, which is never rebuilt (`lib/screening/save.js:79`, `rescreen.js:94`).
4. **Re-score creates a duplicate candidate.** The report's advice when the AI judgement fails ("re-screen") leads either to a 409 or to the duplicate path.
5. **Long CVs lose the job from the judgement prompt.** The whole prompt is cut at 40,000 characters, with the role after up to 34,000 characters of CV (`lib/cv-analysis/prompts/fitJudgmentPrompt.js:284-301`). The cutoff is roughly 31,000 characters, below the 34,000 at which the "CV too long" warning appears.
6. **Retries can outlast the time limit.** Each model call allows 3 tries of 90 seconds, across two stages, inside `maxDuration=240`. Under API overload the function is killed after paying for the tokens. The Voyage call has no timeout.

**Candidates and privacy**

7. **Erasure and subject access exports are incomplete.**
   - Erasure leaves the person's name in `agency_audit_log` and `client_activity`.
   - The subject access export omits SMS messages.
8. **Applications go to the job's creator, not its owner.** `owner_id` isn't loaded for public jobs (`lib/jobs/public-jobs.js:12-13`). A reassigned job's applicants go to the old owner, who is also emailed, and may be hidden from the new owner.
9. **No double-booking check** on interviews or self-booking slots.
10. **Interview reschedules and cancellations miss extra invitees**, who are never stored. The interviews list drops upcoming ones past 500 rows in the window.

**Money**

11. **Totals add GBP, EUR and USD together** and show the sum as pounds.
12. **Fee figures disagree between pages.** There are two sources (`candidates.placement_fee` against `placements.fee_amount`), two date bases, and VAT included in one figure but not another.
13. **Xero and QuickBooks always get the 20% VAT code**, whatever the agency's rate.
14. **Invoices can be double-raised without Redis.** The check and the insert aren't atomic, and the lock is per server instance.

**Messaging**

15. **Sequences send at most 300 emails a day across the platform.** A run that dies mid-send leaves an enrolment stuck for good.
16. **SMS replies can go to the wrong agency.** All agencies share one Twilio number, and an inbound text goes to whichever agency texted it last, including STOP.
17. **No bounce or complaint handling.** Dead addresses keep getting sequence mail from the shared sending domain, which hurts deliverability for every customer.

**Public site and legal**

18. **Sub-processors missing from the published lists.** Twilio and postcodes.io aren't in the DPA or the privacy notice.
19. **No company behind the contracts.**
    - No company name, number or ICO registration.
    - The terms have no governing law or termination clause and don't bring the DPA in by reference.
    - No terms acceptance is recorded at sign-up or checkout.
20. **The demo and contact forms can email strangers.** Both auto-reply to any address typed in, behind only a 10-an-hour IP limit, with no honeypot or CAPTCHA.

## Low

These are worth a ticket each; details are in the area reports.

**Bulk and screening**
- A monthly cap is shown as "hourly limit".
- Four parallel workers can overshoot the cap by three.
- Tech salary bands are applied to non-tech roles when the job family is unknown.

**Candidates**
- Bulk stage changes keep the old sub-stage and skip the `candidate.stage_changed` webhook.
- Custom fields and "keep" (retention) skip the "own candidates only" check.
- Tag edits are read-modify-write, so concurrent edits can lose one.
- A received reference can be overwritten.
- A subject access export restarts the retention clock.
- Follow-ups are limited before they're sorted, so busy agencies lose the most urgent.

**Jobs and clients**
- A live advert can be saved empty.
- Manual click counts overwrite tracked ones.
- Client follow-ups can show a day early.
- Feedback links never expire.

**Money**
- Old invoices reprint with today's company details.
- The payroll export uses today's rates for past weeks.
- Invoices can be raised by direct POST for placements that fell through.
- Timesheets skip the visibility check.
- The invoice list stops at 2,000.

**Messaging**
- Notification reads are shared across the team.
- Webhooks have no retries.
- The audit log has gaps: customisation, integrations and webhook changes aren't recorded.

**Onboarding**
- The getting-started checklist never ticks Import or Invite.
- The sample candidate counts in analytics and toward a monthly cap.
- `/blog` is a stub with past "coming soon" dates.

## Claims the product doesn't back

| Where | Claim | Reality |
|---|---|---|
| FAQ (`lib/faq-content.js:26`) | Deleting your account "removes all analyses, candidates, and billing history" | It deletes the sign-in only; the agency's data stays (`app/api/account/delete/route.js`) |
| Homepage (`app/page.js:141`) | Blind screening "with protected characteristics excluded from scoring" | Only names, contacts, location, the current employer and institutions are redacted |
| Homepage (`app/page.js:186`) | "Encrypted … end to end" | The server and AI providers read the CV text; encrypted in transit and at rest is accurate |
| Pricing, FAQ | "Unlimited screening, no cap" | 100 per user per hour, plus an optional admin-set monthly cap; no fair-use wording |
| Updates | "Shared job description library" | Templates are saved in the browser and aren't shared |
| Terms §5, FAQ | "Cancel from your account settings" | Cancelling is under /billing, not account settings |
| Updates, blog | "Under 20 seconds on average", "surveyed 40 UK agencies" | No data behind either in the repo |
| Careers | London office, a team, four open roles | The privacy notice and DPA say Helixon isn't incorporated yet |
| Privacy, DPA | PostHog "only with your consent" | Cancellation events, including the free-text reason, go to PostHog server-side regardless |

## Untested

**Unit tests** cover the libraries well: scoring, search, retention, money helpers, permissions and webhook signing.

**Routes with no tests at all:**
- placements, invoices, timesheets and exports
- checkout and complete-signup
- the Stripe webhook's ordering, duplicate and second-checkout cases
- every cron route
- the Resend and Twilio inbound webhooks
- public applications, booking, and scorecard and feedback tokens
- import, bulk actions and subject access export completeness
- compare, draft-email and `/api/v1`

**End-to-end** covers page rendering, accessibility and a smoke run only. No flow is tested end to end: screening, bulk, import, sharing with a client decision, offer to invoice to paid, signing, checkout and sign-up, and erasure all go untested.

## Gaps against Bullhorn, Vincere, Recruit CRM, Loxo and Manatal

Ranked by how often an agency would hit them.

1. **Email that lives in the recruiter's own mailbox.** Two-way Gmail and Outlook: send from your own address, replies threaded on the profile, sequences that stop on reply. Also HTML email, signatures, and open and click tracking.
2. **Job board multiposting.** Indeed, Reed, Totaljobs, CV-Library and LinkedIn, or a Broadbean or idibu connector, plus inbox parsing of applications.
3. **Two-way calendar sync** with free/busy for recruiters and interviewers, and automated interview reminders.
4. **A client portal.** A login where clients see their pipeline, approve CVs and give feedback, built on the existing share and feedback token links.
5. **Consent and suppression.** Marketing preferences, an opt-out list that survives re-import, a GDPR request register with the one-month deadline, and right-to-work expiry reminders.
6. **Back office.**
   - Credit notes, invoice email and reminders, PO numbers, manual invoices.
   - Multi-currency reporting.
   - Aged debt (30/60/90 days).
   - Commission statements with clawback on rebates.
   - Contractor fields: IR35 and a status determination statement (SDS), umbrella company details.
   - Client approval of timesheets.
7. **CV handling.** OCR for scanned CVs, .doc and image formats, multi-language CVs, editable parsed work history, branded CVs for clients, and fuzzy duplicate matching (name plus phone).
8. **Team and security.** Custom roles, office-level data separation, SSO/SAML and enforced MFA.
9. **Trust and self-serve.**
   - A free trial.
   - A security page with any certifications held (Cyber Essentials, ISO 27001), and a status page.
   - An integrations page: Xero, QuickBooks, Gmail, Outlook and Twilio already exist but the site never mentions them.
   - API reference docs and a help centre.
10. **An AI copilot in the app.** Ask questions of the pipeline, summarise a shortlist for a client. The screening engine is the differentiator, and nothing builds on it outside /analyse.

## Recommended order

1. **This week: stop harm.**
   - **Data loss:** High 1 (import erasure).
   - **Data exposure:** High 2 (mailbox sync), High 3 (bulk CVs), High 9 (invite emails), Medium 1–2 (blind screening).
   - **Fix the false claims** in the table above.
   - **Site access:** High 11 (redirect loop).
2. **Next: billing and messaging law.**
   - **Billing:** High 6 and 7 (Stripe), High 10 (pay-twice trap).
   - **Messaging law:** High 4 and 5 (unsubscribe and stop-on-reply), Medium 17 (bounces).
   - **Legal pages:** Medium 18–19 (sub-processors, company details, terms acceptance).
3. **Then: trust in the numbers.**
   - **Screening:** High 8 (optional requirements), Medium 3–6 (job edits, re-score, long CVs, timeouts).
   - **Money:** Medium 11–14 (currency, one fee source, VAT codes, atomic invoices).
4. **Alongside, from the start:**
   - Route tests for every route touched in steps 1–3.
   - End-to-end flows for checkout and sign-up, screening, and offer to invoice.
5. **Then the gaps,** in the order above. Two-way email and job-board posting are the ones most likely to decide a sale.
