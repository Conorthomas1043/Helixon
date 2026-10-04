# Helixon: code quality and engineering audit

**Scope:** `helixon-app` at commit `6409590`: 660 source files, about 105k lines of JS/JSX across `app/` (68k), `lib/` (22k) and `components/` (10k), plus 42 SQL migrations.

**Method:** every number below was measured, not estimated:
- `eslint` across the whole repo.
- `vitest --coverage` (v8).
- `npm audit --omit=dev` and `npm outdated`.
- A production `next build`, with chunk sizes and contents inspected.
- Scripted scans of all 202 API routes and 271 database queries on customer data.
- `git log`.

The earlier audits (`ux-psychology-audit.md`, `ux-research-audit.md`) covered the product from the user's side; this one covers the code underneath.

---

## Verdict: what level is the code at?

**Good product code without the engineering safety net.** The parts that carry the business are written with care:
- Scoring (`lib/cv-analysis`) has 84% test coverage.
- Every API route has an auth guard.
- Webhooks verify signatures, and secret comparisons are timing-safe.
- Input is sanitised through shared helpers, with rate limiting and a strict content security policy.
- The repo lints clean.

What's missing is the machinery that keeps code that good as it grows and more people work on it:
- No CI.
- No tests on the API or the UI.
- No type checking.
- Errors aren't reported where anyone would see them.
- Every change goes straight to `main` without review.

Measured against a typical SaaS at this stage:

| Dimension | Level (1–5) | Evidence |
|---|---|---|
| Domain logic (scoring, billing, data rules) | **4** | `lib/cv-analysis` 84% line coverage; pure, tested helpers in `lib/` |
| Security practice | **3.5** | 202/202 routes guarded; HMAC/svix/Twilio signatures verified; CSP; rate limits. But tenant isolation is enforced by hand (see C3), plus one critical dependency advisory (C1) |
| Testing | **1.5** | **15.3%** line coverage overall; **0%** on API routes (7,546 lines), dashboard, admin, employee portal and all components; no end-to-end tests |
| Type safety | **1** | 746 JS files and 2 TS files; `strict: false`; JS isn't type-checked at all |
| Delivery pipeline | **1** | No CI workflow (`.github/` holds only `dependabot.yml`); migrations run by hand; every commit lands directly on `main` |
| Observability | **2** | 251 `console.error/warn` vs 2 `Sentry.captureException`; 53 swallowed promise errors (`.catch(() => {})`); Sentry source maps invalidated by post-build obfuscation (C5) |
| Maintainability | **2.5** | 8 files over 1,000 lines (the candidate profile is 2,696); 5 UI kits, 4 Button components, 3,376 inline style objects, 533 hard-coded hex colours (114 distinct) |
| Performance | **3** | Per-route chunks are all under 100 KB; but the shared `main` chunk is 682 KB, mostly Sentry, Session Replay and PostHog, sent to every visitor whether or not they've consented (C7) |
| Documentation | **2** | Good `.env.example` and code comments. The README is create-next-app boilerplate; there's no architecture doc, runbook or deploy guide |

---

## Findings, ranked

Priority = (Impact + Risk) × (6 − Effort), each scored 1–5. Effort: 1 is under a day, 3 is about a week, 5 is a month or more.

| # | Finding | I | R | E | **Priority** |
|---|---|---|---|---|---|
| C2 | No CI, and no review before `main` | 4 | 5 | 1 | **45** |
| C1 | Critical Next.js advisory | 3 | 5 | 1 | **40** |
| C5 | Obfuscation breaks Sentry; it costs more than it protects | 3 | 3 | 1 | **30** |
| C4 | Migrations applied by hand | 3 | 4 | 2 | **28** |
| C3 | Tenant isolation has no automated check | 4 | 5 | 3 | **27** |
| C9 | Security helper copy-pasted 9 times | 2 | 3 | 1 | **25** |
| C6 | Errors don't reach monitoring | 3 | 3 | 2 | **24** |
| C7 | 682 KB shared chunk, including unconsented tracking code | 3 | 2 | 2 | **20** |
| C8 | No type checking | 3 | 3 | 3 | **18** |
| C10 | Documentation | 2 | 2 | 2 | **16** |
| C11 | Very large page files | 3 | 2 | 3 | **15** |
| C12 | Major-version lag | 2 | 2 | 3 | **12** |
| C13 | Dead code and stray files | 1 | 1 | 1 | **10** |
| C14 | Design-system fragmentation | 3 | 1 | 4 | **8** |

### C1. Critical Next.js advisory (P0)
- **Problem.** `next@16.3.5` is affected by **GHSA-vcvr-r3jv-pc5j**, "Remote Code Execution in next/og ImageResponse" (affects ≥16.2.0 <16.3.6). Helixon uses `ImageResponse` in `app/opengraph-image.js`. That image is static and takes no input from visitors, which probably lowers exploitability, but I couldn't confirm the advisory's exact attack conditions.
- **Also:** `dompurify@3.4.14` (a low-severity DOM XSS advisory, GHSA-p98j-92pf-mc4p) arrives through `posthog-js`.
- **Fix:** upgrade `next` and `eslint-config-next` to **16.3.8** (a patch-level upgrade, not a major version), and update `posthog-js`. Under an hour.

### C2. No CI, and no review before `main` (P0)
- **Problem.** There's no workflow that runs lint, tests or a build. All 56 commits are by one author, the median commit touches **20 files** (the largest 86), and they land directly on `main`. This includes the commits from these audits.
- **Risk.** Nothing stops a red build or a failing test from reaching production. The 495 tests only protect the product if something runs them.
- **Fix:** `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm test` and `next build` on every push and pull request. Then turn on branch protection so `main` only accepts merges that pass CI. Under a day.

### C3. Tenant isolation is enforced by hand, with no test (P1)
**How it works today:**
- Every server query uses the Supabase **service-role** client, which bypasses row-level security.
- New tables enable row-level security but deliberately have no policies, so the database itself doesn't keep one agency's data separate from another's.

**What I measured:**
- **232 of 271** queries on customer tables filter by `agency_id` in the same statement.
- The rest look up a child record after checking its parent's ownership. I hand-checked a sample (for example `candidates/[id]/notes`) and the pattern was correct.

So isolation is correct today, as far as sampling can show. But one forgotten `.eq("agency_id", …)` in a future route would leak one agency's candidates to another, and no test would catch it. Two fixes, in order:
1. **Tests** (about 3 days): a small harness that calls each agency-scoped route as agency A, asking for agency B's records, and expects 404/403 back. It's table-driven, so new routes are covered by adding one line.
2. **Defence in depth** (about 2 weeks): give routes a per-request Supabase client carrying the user's identity, with policies of the form `agency_id = (auth.jwt() ->> 'agency_id')::uuid`. Keep the service-role key for crons and webhooks only.

### C4. Migrations are applied by hand (P1)
- **Problem.** `supabase/manual/2026-10-03_run_in_sql_editor.sql`, and the latest commit's note that a migration must be applied, show schema changes reaching production by someone pasting SQL into the editor.
- **Risk.** The code and the database drift apart without anyone noticing. Several routes already contain fallback code for "column doesn't exist yet" (`42703`, `42P01`), which is a sign of exactly that drift.
- **Fix:** `supabase db push` in a deploy step, or at least a CI check that compares `supabase migration list` with the repo.

### C5. Post-build obfuscation breaks error reporting and costs more than it protects (P1)
- **Problem.** `postbuild` runs `scripts/obfuscate-build.mjs` over the client chunks *after* `withSentryConfig` has uploaded source maps for them. The maps no longer match the shipped code, so production stack traces in Sentry can't be read.
- **Cost.** Obfuscation also makes bundles larger and slower to parse.
- **Benefit is small.** Client code is public by nature, and every secret already lives on the server.
- The script's own comment says the app builds with Turbopack, but `build` forces `--webpack`, so the comment is out of date.
- **Fix:** remove the postbuild step. If keeping it is a requirement, upload source maps *after* obfuscation instead.

### C6. Errors don't reach anyone (P1)
- **Problem.**
  - 251 `console.error`/`console.warn` calls but only 2 `Sentry.captureException`. Handled errors are written to Vercel logs and nowhere else.
  - 53 `.catch(() => {})` calls drop failures silently, mostly on fire-and-forget fetches.
  - `tracesSampleRate: 1` on client, server and edge means every request is traced, which is costly at scale.
- **Fix:** a `reportError(scope, err)` helper that logs *and* captures to Sentry, swapped in for `console.error` in API routes. Lower tracing to 0.1–0.2 in production.

### C7. 682 KB of shared JavaScript on every page (P2)
- **Problem.** The `main` chunk contains Sentry (252 matches), Session Replay/rrweb and PostHog (165) statically. It loads for every visitor, including those who chose "Essential only", even though replay and analytics only start after consent.
- **Fix:** load the replay integration lazily (`Sentry.lazyLoadIntegration("replayIntegration")`) and import `posthog-js` dynamically, both inside the consent handler in `instrumentation-client.js`. That should cut a few hundred KB of first-load JavaScript and help the homepage's Core Web Vitals.

### C8. No type checking (P2)
- **Problem.** 746 JS files and 2 TS. `tsconfig.json` has `strict: false` and only includes `.ts`/`.tsx`, so not one JS file is type-checked. Data shapes pass between API, `lib/` and UI with nothing checking them. One example: a comment in `app/dashboard/page.js` describes reading `data.agency.name`, a key that never existed, so the header silently showed nothing.
- **Fix:** incremental, not a rewrite.
  1. Turn on `checkJs` for `lib/` only, with JSDoc types on exported functions. Fix the findings, then widen to `app/api`.
  2. New files in TypeScript.
  3. Validate request and response shapes at API edges with a small schema library (for example zod).

### C9. A security-sensitive helper is copy-pasted 9 times (P2)
- **Problem.** `timingSafeEqualStr`, the constant-time secret comparison, is re-implemented in 9 files, even though `lib/cron-auth.js` (`cronAuthorized`) already exists for exactly this purpose. `escapeHtml` has 4 copies and `formatDate` 7.
- **Risk.** A bug fixed in one copy stays unfixed in the others.
- **Fix:** route every cron/secret check through `lib/cron-auth.js`, and keep one `escapeHtml` and one date formatter in `lib/`.

### C10. Documentation (P2)
- **Problem.** `helixon-app/README.md` is create-next-app boilerplate. There's no architecture overview (auth layers, the service-role pattern, crons, webhooks, the scoring pipeline), no deploy or migration runbook, and no incident guide.
- **Also:** 128 comments narrate past bugs ("used to…", "previously…"). That's history that belongs in git, and it makes files harder to read.
- **Fix:** `docs/architecture.md` and `docs/runbook.md`, and trim history from comments as files are touched.

### C11. Very large page files (P2)
- **Problem.** 8 files are over 1,000 lines and 32 over 500. The worst:

  | File | Lines |
  |---|---|
  | `dashboard/candidates/[id]/page.jsx` | 2,696 |
  | `dashboard/page.js` | 1,709 |
  | `EmployeeMobileApp.jsx` | 1,262 |
  | `lib/dashboard-api.js` | 1,260 |

  These are the screens changed most often, and they have no tests. Every edit is a large, risky diff.
- **Fix:** split panels into `components/candidate/*` as they're touched. No big-bang refactor.

### C12. Major-version lag (P3)
- **Problem.** 23 packages are outdated. Six are a major version behind: `@sentry/nextjs` 10→11, `stripe` 22→23, `recharts` 2→3, `@google/genai` 1→2, `eslint` 9→10, `typescript` 6→7.
- **Fix:** Dependabot is set up, but with no CI its PRs can't prove they're safe. Fix C2 first, then take one major upgrade per week.

### C13. Dead code and stray files (P3)
- Six retired API routes still exist only to return 410: `extract-cv`, `extract-job`, `agency-settings`, `candidate-notes`, `jobs/[id]/add-candidates`, `jobs/[id]/update-status`. Their own comments say to delete them.
- `current-globe.txt` (26 KB at the repo root, plus an empty copy in the app).
- An empty `package-lock.json` at the repo root.
- `emails/VerifyEmail.jsx`, which nothing imports.

### C14. Design-system fragmentation (P3)
- **Problem.** Five separate UI kits (`components/dashboard/ui`, `app/analyse/_components/ui`, `components/account/ui`, `app/admin/_shared/ui`, `app/employee/_shared/ui`), four Button components, 3,376 inline `style={{…}}` objects next to 6,197 `className`s, and 533 hard-coded hex colours (114 distinct) despite CSS tokens existing.
- **Effect.** Visual inconsistency, and changes to theming or accessibility have to be made in five places.
- **Fix:** standardise on one kit for customer-facing screens, plus a lint rule against new hex literals.

---

## What's already good (keep it)
- **Auth on every route:** 152 `requireCustomerContext`, 37 `requireAdminSession`, 26 `employeeAccess`, plus signed webhooks and token-scoped public links.
- **Input hygiene:** shared `lib/sanitize` helpers, per-IP and per-email rate limits, prompt-injection screening on the chat assistant.
- **Privacy engineering:** consent-gated analytics, data-retention crons, scrubbing before storage, a GDPR erasure path.
- **The scoring engine** is well tested and has evaluation tooling (`eval:cv`, `eval:labelled`, `calibrate`, `eval:fairness`).
- **Clean lint** across the whole repo; no `TODO`/`FIXME` rot.

---

## Remediation plan (alongside feature work)

| Phase | When | Items | Outcome |
|---|---|---|---|
| **1. Stop the bleeding** | This week, about 2 days | C1 Next patch · C2 CI + branch protection · C5 drop obfuscation · C13 delete dead code | No known critical vulnerabilities; nothing reaches `main` without passing lint, tests and build; readable production errors |
| **2. Safety net** | Weeks 2–4 | C3 cross-tenant tests · C6 `reportError` + sampling · C4 migration check · C9 dedupe helpers | Data leaks between agencies and silent failures become detectable |
| **3. Raise the floor** | Month 2 | C7 lazy-load tracking · C8 `checkJs` on `lib/` · API route tests for screening, billing and sharing · C10 architecture doc and runbook | Coverage from 15% to ~40% on the code that handles money and candidate data |
| **4. Ongoing** | Every PR | C11 split big files when touched · C12 one major upgrade a week · C14 consolidate UI kits · RLS policies (C3) | Steady reduction without a freeze |

---

## Reproducing these numbers
```bash
cd helixon-app
npx eslint .                                   # 0 problems
npx vitest run --coverage                      # needs @vitest/coverage-v8 matching vitest; 15.3% lines
npm audit --omit=dev                           # 1 critical (next), 1 low (dompurify)
npm outdated
npx next build --webpack && du -sh .next/static/chunks
```
