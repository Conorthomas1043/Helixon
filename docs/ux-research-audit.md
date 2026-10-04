# Helixon: UX research audit

**Role:** senior UX researcher · **Scope:** the whole codebase (`helixon-app`, about 105k lines, 90+ screens) · **Date:** October 2026

## How to read this

This is a **research** audit, not a defect list. The earlier audits (`docs/ux-psychology-audit.md`) found and fixed conversion and usability defects. This one asks the questions underneath them:

- Who uses Helixon, and for which jobs?
- Where does the product's model of the world differ from the users'?
- What do we know, what are we guessing, and how would we find out?

**Evidence base.** Every finding comes from reading the code: routes, components, copy, API contracts and analytics events. It does **not** come from interviews or usage data, because none were available. Each insight is therefore graded:

- **Observed:** a fact about the product, true in the code.
- **Inferred:** a likely effect on users, reasoned from the code.
- **Unknown:** something only research or data can answer.

Treat everything below the "observed" level as a hypothesis to test, not a conclusion.

---

## 1. Who uses Helixon

| Persona | What they're trying to do | Touchpoints in the code | Account? | How often | Research coverage today |
|---|---|---|---|---|---|
| **Agency owner / buyer** | Decide whether Helixon pays for itself; set up the team; control cost and compliance | Marketing site, `/pricing`, `/demo`, checkout, `/signup`, `/billing`, Team, Settings, Analytics, Performance | Yes (admin) | Weekly | Demo-form free text; cancellation reason (new) |
| **Recruiter** | Get from a pile of CVs to a shortlist a client will act on, then move people through to placement | `/analyse`, Candidates, Candidate profile, Pipeline, Jobs, Clients, Interviews, Email, Talent pool, Shortlists | Yes (member) | Daily, many hours | Analysis thumbs up/down only |
| **Client / hiring manager** | Decide quickly who to meet, with as little effort as possible | `/share/[token]`, `/scorecard/[token]`, client pack, feedback requests | No (link) | Occasional, unplanned | None |
| **Candidate / applicant** | Apply without friction; know where they stand | `/jobs/[slug]`, apply form, `/portal`, `/book`, `/sign`, `/feedback` | No (link) | Rare, high anxiety | Agency-run NPS (via feedback requests) |
| **Referee** | Give a reference with minimal effort | `/reference/[token]` | No (link) | Once | None |
| **Helixon staff** | Run the business, support customers | `/admin/*`, `/employee/*` (both with dedicated mobile apps) | Separate auth | Daily | n/a |

**Observed:** half of Helixon's users (clients, candidates, referees) never log in and meet the product through one link, usually on a phone, with no context. They decide whether the agency looks professional, and they have the least research coverage of anyone.

---

## 2. Key insights

### R1. The product sold and the product built are different products · Inferred · High impact
- **Sold as:** "AI CV screening for recruitment agencies". The homepage, metadata and pricing all lead with screening.
- **Built as:** a full agency operating system. The nav has **19 destinations**, including invoices and timesheets, business development, SMS, e-signatures, interview self-booking, references, compliance, a talent pool, email sequences, and integrations with Xero, QuickBooks, Gmail and Outlook (`components/DashboardNav.jsx`, `app/dashboard/*`).
- **Individual plan users** (one recruiter, £249) see the same full agency navigation as Agency plan users, including Team, Performance and Business development.
- **Likely effects:**
  - A buyer who came for screening meets an applicant-tracking/CRM system and has to work out what to ignore.
  - An agency shopping for an ATS never finds Helixon, because the site doesn't say it is one.
  - Expectations set on the site ("upload, score, shortlist") don't match the first session's complexity.
- **Unknown:** which jobs paying customers actually hire Helixon for. Is it screening-only, screening plus pipeline, or a whole-desk replacement? Do Individual users ever open the Revenue or Workspace sections?
- **Study:** S1 (JTBD interviews) + Q2 (feature reach by plan).

### R2. One action, many names · Observed · Medium impact
Users build a mental model from labels. Counted across the UI strings:

| Concept | Names in use |
|---|---|
| The core action | **Analyse** (nav tab, page title), **Screen** (marketing, checklist, emails), **Score** (buttons, copy) |
| Its output | **Assessment** (report heading), **analysis**, **report**, **screening** |
| The thing being filled | **Job** (nav, 325 strings) and **role** (analyse flow, 236 strings) |
| "Shortlist" | A pipeline **stage** ("Shortlisted") *and* a separate shareable **list** feature ("Shortlists", "Add to shortlist…") |
| Score bands | "Strong Match / Worth Reviewing / Weak Match" (`lib/scoreBands.js`), "Strong match / Worth reviewing / Not suitable" (AI recommendation), "Strong / Review / Weak" (dashboard and homepage), "Weak match" (`lib/candidate-format.js`) |

- **Inferred:** "Shortlisted" vs "Shortlists" is the riskiest overlap. A recruiter can move someone to the Shortlisted stage and assume the client can see them; they can't until the candidate is added to a Shortlist and shared.
- **Study:** S3 (card sort and terminology test). **Quick win:** a product glossary, and one name per concept.

### R3. Four ways to see people, two ways to see performance · Observed · Medium impact
- **People:** Candidates (database), Pipeline (stage board), Talent pool (people kept for later), Shortlists (lists for clients). Each answers a different question, but nothing in the nav says which question.
- **Performance:** "Performance" (targets) and "Analytics" (agency metrics) both sit under Revenue. "Overview" also shows KPIs.
- **Odd placements:** "Email" is filed under Sourcing. "Compare" is a tool, not a place, but it's listed as a destination.
- **Unknown:** whether recruiters can predict where to go for "everyone I'm working on for the Brightline role", or "who should I chase today".
- **Study:** S3 (tree test).

### R4. The candidate profile carries the product, and it's overloaded · Observed + Inferred · High impact
- **Observed:** `app/dashboard/candidates/[id]/page.jsx` (2,580 lines) renders about **27 panels** in two fixed stacks:
  - **Main column:** Match overview, Interviews, Full analysis, Custom fields, Experience, Documents, Activity.
  - **Right column, 15 panels in this order:** Talent pool, Stage and owner, Placement, Booking links, Documents, Compliance, Self-service, Outcome reporting, Feedback requests, **Call notes, Notes**, Email thread, Email, SMS, Merge duplicates.
- **Inferred:** the order follows when each feature was built, not how often it's used.
  - Notes, probably the most frequent action after changing stage, is 11th in the right column. On a phone the columns stack, which puts Notes roughly **20 panels** down. The "N" keyboard shortcut only helps people on desktop who know it exists.
  - Three separate messaging panels (email thread, compose email, SMS) split one job: "contact this person".
- **Unknown:** the actual frequency of each panel's use.
- **Study:** add panel-interaction events (§4), then S2 (contextual inquiry).
- **Hypothesis to test:** group by job — **Assess** (score, evidence, CV), **Engage** (notes, calls, email, SMS, interviews), **Place & comply** (placement, documents, compliance, signatures). Default to the group that matches the candidate's stage.

### R5. Mobile was prioritised for staff, not for customers · Observed · Medium impact
- **Observed:** `/admin/mobile` and `/employee/mobile` are dedicated mobile apps. Customer screens are responsive layouts only; `/analyse` and the candidate profile have no mobile-specific handling at all. The site manifest does declare `standalone`, so the app can be installed.
- **Inferred:** recruiters spend much of the day on the phone and away from a desk ("call the candidate back", "log the call", "check who's next"). These are exactly the moments the profile page is hardest to use.
- **Unknown:** the device split among signed-in users.
- **Study:** Q4 (device mix), then decide.

### R6. The client's yes/no can be lost silently · Observed · High impact (fix candidate)
- **Observed:** on `/share/[token]`, choosing Interview / Maybe / Not for us only selects an option. Nothing is recorded until the client also presses **Send**. The comment box has a placeholder but no label.
- **Inferred:** a hiring manager reviewing on a phone between meetings taps "Interview", sees it highlighted, and closes the tab, thinking they've answered. The recruiter sees no response and chases. The client has the poorest context of any user, and this flow asks the most of them.
- **Also missing:**
  - A summary at the end ("You've responded to 3 of 5").
  - Any way to compare candidates side by side.
  - Any record of whether the client opened the link.
- **Unknown:** how many shares get no response at all.
- **Study:** S4. **Quick win:** save on tap, and make the comment optional and saved separately.

### R7. Trust in the AI is designed in, but not measured · Inferred · High impact
**Strong already:**
- Each score shows its evidence: the requirement, the line from the CV, and what still needs checking.
- Must-have failures cap the score at 40 and say why, so a green score can't sit next to "Not suitable".
- Recruiters can disagree, and their bands feed calibration (`lib/cv-analysis/calibration`).
- Protected characteristics are excluded in every prompt, and blind screening exists.

**Gaps:**
- **The thumbs-down reasons** ("Missed a key skill", "Got seniority wrong", "Missed a red flag", "Score too high/low", "Other") can't capture the likeliest failures: *the CV was read wrongly* (parsing), *the job spec was misunderstood*, or *the evidence quoted is wrong*.
- **Disagreement comments go nowhere a human at Helixon reads.** They feed calibration and the agency's own analytics, but no admin view lists them across agencies.
- **There is no fairness testing.** `scripts/eval-samples` has 6 fictional CVs for checking run-to-run consistency. Nothing scores pairs of CVs that differ only in name, career gap or school, even though the homepage advertises "bias-aware scoring".
- **Regulation:** CV screening is classed as high-risk under the EU AI Act (Annex III). Any EU agency customer will eventually ask for this evidence.

**Unknown:**
- Do recruiters over-trust the score (shortlisting by number) or under-trust it (re-reading every CV)? Both destroy the value.

**Studies:** S5 (trust calibration), S6 (counterfactual fairness audit).

### R8. Helixon hears from almost nobody · Observed · High impact
| Channel | Exists? | Who reads it |
|---|---|---|
| Demo-form "What are you hoping to solve?" | Yes | Sales inbox only, never analysed |
| Website chat assistant (`/api/assistant`) | Yes | **No one.** Questions aren't stored. These are the clearest record of visitor objections |
| Analysis thumbs up/down + reason | Yes | Calibration; the agency's own analytics |
| Cancellation reason | Yes (new) | PostHog, server-side |
| NPS / CSAT for recruiters | **No** (yet agencies can send NPS surveys to *their* candidates) | n/a |
| In-product "give feedback" | **No** | n/a |
| Session replay | Sentry, 10%, consented visitors only | Engineering, for bugs |
| Research participant recruiting | **No** opt-in anywhere | n/a |

**Inferred:** product decisions so far have been based on the builders' judgement. The code comments show careful judgement, but there's no feedback loop that would catch a wrong guess.

### R9. Invited teammates get no onboarding · Observed · Medium impact
- An invited member signs up through the invite path and lands on `/dashboard`.
- The new **Getting started** checklist only appears for an *empty* agency, so a recruiter joining an active team sees a full dashboard with no orientation.
- They don't know which jobs are theirs, how the team uses stages, or the keyboard shortcuts.
- **Unknown:** the share of seats that become active (a member who screens at least once in their first week).
- **Measure:** Q5.

### R10. Candidates still disappear into a black hole after applying · Inferred · Medium impact
- Applicants now get an on-screen confirmation and an email.
- After that, nothing tells them when they've been reviewed, rejected or moved forward. Stage changes deliberately send no automatic email, which is safe, but it leaves the agency to remember.
- **Unknown:** how agencies close the loop today (manually, by sequence, or not at all).
- **Study:** a question in S1. A possible feature is an optional, recruiter-approved status update.

### Strengths worth protecting
- **Explainable scoring.** Evidence, what still needs checking, interview questions, and a cap with a reason.
- **Honest copy discipline**, now enforced across the site.
- **Accessibility done properly:** roving tabs, inert accordions, a keyboard-friendly "Move to…" alternative to drag-and-drop on the pipeline, reduced-motion support, and focus management in dialogs.
- **Low-friction external pages:** the client, candidate and referee pages need no login, and every page shows the agency's name.
- **Consent-first analytics.** It's a trust asset with this audience; don't trade it away for data.

---

## 3. Minor findings
- The client comment box on `/share` uses a placeholder as its only label.
- The pipeline's "Move to…" control is 24px, which meets the minimum target size but is fiddly on touch screens.
- External pages show a bare "Loading…" with no agency name until data arrives, so the first impression is unbranded.
- Score band names vary (see R2), and "Not suitable" reads as a verdict on the person rather than the match.

---

## 4. Measurement framework (HEART)

| Goal | Signal | Metric | Event source (exists?) |
|---|---|---|---|
| **Happiness** | Recruiters trust scores | % of analyses rated 👍; thumbs-down reasons mix | `analysis_feedback_submitted` ✅ |
| | Recruiters would recommend Helixon | Quarterly in-app NPS | ❌ add |
| **Engagement** | Screening is habitual | Analyses per active seat per week | `analysis_completed`, `bulk_analysis_finished` ✅ |
| **Adoption** | Teams adopt beyond screening | % of agencies using shortlists, sharing, interviews and placements in their first 30 days | `shortlist_shared`, `job_created` ✅; interview and placement events ❌ add |
| **Retention** | Agencies stay | Logo churn; `payment_failed` → `payment_recovered` rate | Server billing events ✅ |
| **Task success** | Screening works | `analysis_failed` ÷ attempts; bulk failed ÷ total | ✅ |
| | Clients answer | Shares with ≥1 decision ÷ shares sent; median time to first decision | ❌ add `share_opened`, `share_decision` |
| | Profile is efficient | Interactions per panel; scroll depth to Notes | ❌ add `profile_panel_used` |

- **Activation (proposed):** a workspace screens ≥1 CV within 24 hours of `workspace_created`, and ≥5 within 7 days.
- **North-star candidate:** *shortlists that reach a client and get a decision, per agency per week.* It counts the value Helixon creates for the agency's own customer, not just screening activity.

---

## 5. Research plan

| # | Study | Method | Participants | Answers | Effort |
|---|---|---|---|---|---|
| **S1** | Why agencies hire Helixon | Jobs-to-be-done interviews, 45 min | 8 owners/buyers (mix of Individual and Agency, active and churned) + 6 recruiters | R1, R10; which features matter; positioning | 2–3 wks |
| **S2** | A day on the candidate profile | Contextual inquiry (screen-share shadowing) plus a 5-day diary | 5 recruiters at 3 agencies | R4, R5; real panel order; mobile moments | 2 wks |
| **S3** | Do our words and nav match theirs? | Open card sort (terms and destinations) + tree test of the current nav vs a regrouped one | 30 recruiters, unmoderated | R2, R3 | 1 wk |
| **S4** | The hiring manager's 5 minutes | Remote usability test of a real `/share` link on a phone | 5 hiring managers (recruited through customer agencies) | R6 | 1 wk |
| **S5** | Over-trust or under-trust? | Calibration study: recruiters rate 20 CVs blind, then see Helixon's score; compare agreement and how far they move | 10 recruiters | R7 | 2 wks |
| **S6** | Is scoring fair? | Internal counterfactual audit: 50 CV pairs differing only in name, gap, school or postcode; measure score deltas | None (offline eval) | R7, EU AI Act readiness | 1 wk eng |
| **S7** | Why agencies leave | Exit interviews from `cancellation_started` + a lost-deal review of demo requests that never bought | 6–8 | R1, pricing | Ongoing |

**Recruiting participants** (not built yet):
1. A one-time in-app "Help shape Helixon" opt-in in Account settings.
2. A checkbox on the demo form.
3. The cancellation dialog: "Would you talk to us for 15 minutes?"

---

## 6. Queries to run now (no new code)

Aggregate-only; run in the Supabase SQL editor or as PostHog insights. They return counts, not personal data.

- **Q1. Activation:** share of agencies created in the last 90 days that have ≥1 candidate within 1 day and ≥5 within 7 days (`agencies.created_at` vs `candidates.created_at`).
- **Q2. Feature reach by plan:** for each agency, plan × whether it has jobs, shortlists, shortlist shares, interviews, placements, invoices or talent-pool entries. This answers R1 directly.
- **Q3. Score trust:** the `feedback` table, the up/down split by month, and the down reasons (`comment`), grouped.
- **Q4. Device mix:** PostHog `$device_type` for identified users on `/dashboard*` and `/analyse`.
- **Q5. Seat activation:** members whose profile is ≥7 days old with ≥1 candidate where `recruiter_id` = them.
- **Q6. Client response:** shortlist shares vs shares with ≥1 decision, and the median hours to the first decision.

---

## 7. Quick wins that don't need research first
1. **`/share`:** save the decision on tap (the comment stays optional), add a real label to the comment box, and show "x of y answered" when the client finishes. (R6)
2. **Admin "Voice of customer" view:** thumbs-down analyses with reasons and comments across agencies, demo-form problems, and cancellation reasons. (R7, R8)
3. **More thumbs-down reasons:** add "Read the CV wrongly", "Misunderstood the job" and "Quoted the wrong evidence". (R7)
4. **Store chat-assistant questions:** anonymised and under the existing consent, tagged by topic. (R8)
5. **A welcome for invited teammates:** a short checklist, covering "your jobs", how this team uses stages, and shortcuts. (R9)
6. **A glossary,** then one name per concept. Decide "Shortlisted" stage vs "Shortlists" first. (R2)
7. **Instrument** `share_opened`, `share_decision`, `profile_panel_used`, `interview_scheduled` and `placement_created`. (§4)
