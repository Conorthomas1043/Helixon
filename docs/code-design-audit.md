# Helixon: code design audit and engineering level

**Scope:** `helixon-app` at `03ecaf2` (main): 196 API routes, about 68,600 lines in `app/`, 29,200 in `lib/`, 10,500 in `components/`, and 45 SQL migrations.

**Method:**
- **Measured, not estimated.** Every count below comes from `grep`, `find`, `wc` or `git` against this commit. The commands are at the end.
- **Read:** the shared building blocks (route wrapper, auth, the agency database client, error reporting, the scoring pipeline's entry points), the largest routes and pages, the migrations, the CI workflows and the ratchet tests.
- **Builds on:** the earlier audits in `docs/`. `code-audit.md` (at `6409590`, 4 October) covered quality and tooling; this one is about **design**: how the code is structured and what that says about the level it was written at.

**Who wrote it:** the repo is a shallow clone. Its history is one import commit (570 files, 91,848 lines) followed by 53 commits, all made by Claude sessions except one.
- So this rates **the code as it stands**, not a person.
- Much of the guardrail work described below was added on or after 4 October, in response to the earlier audits.

---

## Verdict

**Overall: strong mid-level, on the edge of senior.**

The parts where a mistake is expensive are designed at a **senior** level, and the CV-scoring evaluation goes beyond that:
- tenant isolation;
- the data model;
- the scoring engine;
- the delivery pipeline.

The code you work in day to day is **mid-level**: the 196 API routes and the dashboard pages.
- Business logic and database queries sit inline in route handlers.
- A few handlers run to hundreds of lines.
- Validation mostly checks "is it a JSON object".
- Data shapes between server and browser aren't typed.

A team's level is set as much by its ordinary code as by its best code, so the overall rating sits between the two.

**What would make it clearly senior:**
- domain operations moved into services;
- typed contracts at the API boundary;
- real request validation;
- tests on the routes that touch money and permissions.

All four are incremental changes, not rewrites (see the plan at the end).

---

## The levels used here

| Level | What the code shows |
|---|---|
| **Junior** | It works on the happy path. Copy-paste instead of abstractions. Secrets or tenancy handled ad hoc. No tests, no CI |
| **Mid** | Features are well built and readable. There's sensible structure, but patterns are inconsistent across the codebase. Logic sits wherever it was first needed. Tests cover the pure functions. Guardrails are added after problems appear |
| **Senior** | Designed for failure and for the next engineer. One way to do each risky thing, enforced by tooling. Defence in depth. Tests aimed at the risks. Trade-offs written down. Errors reach someone |
| **Staff** | Sets direction across the system. Clear boundaries and typed contracts. Patterns other people adopt. Quality is measured and changes are gated on the measurements |

---

## Scorecard by area

| Area | Level | Why, in one line |
|---|---|---|
| Scoring engine and its evaluation | **Senior+** (staff-grade evaluation) | A clean pipeline behind one entry point, plus labelled evals, weight fitting and a counterfactual fairness audit that can gate a change |
| Security and tenant isolation | **Senior** | One route wrapper, an optional second check at the database layer, and two ratchet tests that stop regressions |
| Data model and migrations | **Senior** | 193 CHECK constraints, 85 foreign keys, 89 indexes, RLS on every table, a gated migration workflow |
| Delivery and quality guardrails | **Senior** (since 4 Oct) | CI runs lint, types, tests, migrations, build and end-to-end tests. Four ratchet tests stop known problems coming back |
| Observability | **Senior−** | A shared error reporter, and no silent `catch`es. But post-build obfuscation still breaks Sentry's source maps |
| Comments and docs | **Senior−** | Comments explain *why*. The architecture doc and runbook exist but are short. 130 comments narrate past bugs |
| API route design | **Mid** | The wrapper covers 79 of 196 routes. 587 queries inline in handlers. Two god handlers. Validation mostly nominal |
| Front-end architecture | **Mid** | 28 of 34 dashboard pages load their data in the browser, in `useEffect`. No shared data cache. 1,133 `useState` calls, 29 in one component |
| Test breadth | **Mid** | 113 test files, strong on `lib/`. Only 2 route-level test files for 196 routes. Coverage isn't measured |
| Types and contracts | **Mid−** | Plain JS with `strict: false`. 64 JSDoc tags in the whole app. Shapes between API and UI are unchecked |
| Change management | **Mid−** | Median commit touches 21 files (the largest 240), straight to `main`, with no branches or reviews |

---

## What reads as senior, and why

**1. Risky behaviour has one way in, and tooling keeps it that way.**
- **The route wrapper.** `lib/api/route.js` signs the member in, validates the body and turns anything thrown into a JSON error reported to Sentry. Handlers throw an `ApiError` for expected failures.
- **The route ratchet.** `lib/api/route-usage.test.js` lists the 20 routes allowed to sign members in by hand, each for a stated reason, and fails if a new route joins them.
- **The tenant ratchet.** `lib/security/tenant-isolation.test.js` finds every query on an agency-owned table that lacks an `agency_id` filter. It records the count per file and fails when a file gains one.
- **Why this is senior:** the rules are enforced by tooling, not left to memory.

**2. Defence in depth on the one bug that would end the business.**
- **The second check.** `lib/agency-db.js` can sign a short-lived JWT for an `agency_member` database role. The RLS policies from migration `20261005000000_agency_member_rls.sql` then refuse other agencies' rows even if a query forgets its filter.
- **Both checks stay.** The code filters first and the database checks second, and the file's comment explains why both exist.
- **The test double can't pass by accident.** The route-test fake (`test/fake-db.js`) ignores filters it doesn't understand, which only ever widens results. A test that one agency can't see another's rows therefore fails safe.

**3. The scoring engine is built to be measured, not just to run.**
- **One entry point.** `lib/cv-analysis/index.js` is the single public surface, with stages for extraction, validation, knockout, evidence, embedding match and fit judge.
- **Consistent batches.** Job parsing is cached so all 50 CVs in a bulk run are scored against the same reading of the role (`pipeline/analyseCV.js`, with the reason in a comment).
- **No stacked retries.** Retries are left to the SDK, which honours `retry-after`, instead of wrapping a second loop around it (`anthropic/askClaude.js:19-25`).
- **Evaluation scripts:**
  - labelled evaluation: `npm run eval:labelled`;
  - weight fitting: `npm run calibrate`;
  - a counterfactual fairness audit: `scripts/eval-fairness.mjs`. It changes one protected signal at a time (name, career break, disability, school), reports differences larger than the pipeline's own run-to-run noise, and exits 1 so it can gate a scoring change.
- **Tests:** 93 in 12 files under `lib/cv-analysis/tests`.
- **Why this goes beyond senior:** this is the evaluation discipline of a staff-level ML engineer.

**4. The data model carries its own rules.**
- **Constraints in the database:** 193 CHECK constraints, 85 foreign keys, 38 unique constraints and 89 indexes across 45 migrations.
- **RLS everywhere:** RLS is enabled on 39 tables, which denies the anonymous key by default.
- **Hardened functions:** database functions set `search_path` (35 occurrences).
- **Migration safety:** CI checks migration names and order (`scripts/check-migrations.mjs`). Migrations are applied by a manually run workflow tied to the `production` environment, with a dry-run option (`.github/workflows/migrate.yml`).

**5. Errors reach someone.**
- **One reporter.** `lib/report-error.js` logs and sends to Sentry, tagged by scope. It has 245 call sites, against 28 remaining `console.error/warn` calls.
- **No silent catches.** Fire-and-forget work uses `.catch(reportQuietly)`, and there are no empty `catch` blocks left.
- **Consent respected.** Session Replay loads lazily, only after cookie consent (`instrumentation-client.js:112`).

**6. Comments explain decisions.** The comments say *why*, not *what*:
- why both tenant checks exist;
- why job parsing is cached;
- why the obfuscator runs after the build.

A new engineer can learn the trade-offs from the code.

---

## What reads as mid-level, and why

**1. Routes are transaction scripts.**
- **Queries live in handlers:** 587 `.from("…")` queries sit in `app/api` route handlers, against 260 in `lib/`. Most features have no service layer: the handler reads, decides and writes.
- **That works for CRUD,** but complex operations end up inside routes:
  - **`app/api/run/route.js`:** its `POST` handler runs from line 95 to about line 703, roughly 600 lines in one function. It covers configuration, rate limits, sign-in, file checks, quota, scoring and saving.
  - **`app/api/admin/users/route.js`** (812 lines) holds business operations such as `provisionAgency`, `grantDemoAccess` and `applyClerkAction`. Those belong in `lib/admin/`, where they could be tested.
- **A senior design** would put each of these behind a named domain function and keep the route as a thin adapter.

**2. Validation is mostly nominal.**
- **What the schemas check.** 61 routes pass a body schema to the wrapper, but 50 of them use `JsonObject`, which accepts any object.
- **Where field rules live.** Field rules are spread across per-domain "cleaners", and the 7 field-level schemas in `lib/api/schemas.js` accept a string *or* a number for most fields and let unknown keys through.
- **What's left unvalidated.** Another 65 routes still read `request.json()` themselves.
- **The cost:** request shape is checked in two places, loosely, and no single place says what a route accepts.

**3. Patterns are inconsistent across areas.**
- **Three ways to sign in.** Customer routes use the wrapper. Admin routes use their own guard (21 routes). Staff-portal routes use `employeeAccess` from `lib/session`.
- **A stray client.** One staff-portal route (`app/api/employee/ops/route.js`) builds its own Supabase client instead of using `lib/supabase`.
- **Copies of the same helper.** There are still 8 separate `formatDate` definitions.
- **A flat library.** `lib/` has 129 modules at the top level, next to 11 folders. Related code (`agency-*`, `analytics-*`, `email-*`, `compliance-*`) is grouped by file-name prefix rather than by folder.
- **Why this is mid-level:** each choice is reasonable alone, but together they mean a new engineer has to learn each area's habits separately.

**4. The front end fetches on the client and keeps state locally.**
- **Rendering.** 228 of 503 files under `app/` and `components/` are client components.
- **Fetching.** 28 of 34 dashboard pages load their data in the browser, in `useEffect`. The Overview, Candidates, Jobs and the candidate profile load on the server.
- **No shared layer.** There's no data cache (no SWR or React Query) and no React context anywhere (0 `createContext`).
- **State.** State is local: 1,133 `useState` calls, with 29 in `AnalyseWorkspace.jsx` and 27 in `candidate-extras.jsx`.
- **To its credit:**
  - Browser calls go through one client layer (`lib/api-client/`, 17 area modules).
  - Out-of-order responses are guarded in 116 places.
  - The kit (`components/ui`) is well designed.
- **Why this is still mid-level:** the structure carries a lot of hand-written state that a senior design would move into the server, a cache or reducers.

**5. No typed contracts.**
- **The setup:** JavaScript with `checkJs`, but `strict: false`, and only 64 `@param`/`@typedef`/`@returns` tags across `app/` and `lib/`.
- **What the typecheck does:** its baseline (73 known errors, as a ratchet) stops new inference errors.
- **What it doesn't do:** nothing checks that the JSON a route returns matches what a page reads. The earlier audit found exactly that kind of bug: a header reading a key that never existed.
- **Why this matters:** for a 110,000-line multi-tenant app, that's the biggest structural gap.

**6. Tests are strong on functions and thin on the system.**
- **Strong on `lib/`:** 113 test files and about 600 tests.
- **Thin on routes:** only `app/api/agency-isolation.test.js` (12 tests) and the Stripe webhook test (3) exercise routes.
- **What's untested:** billing changes, invoices, team permissions and erasure are covered only by static ratchets and the functions they call.
- **Thin end-to-end:** the end-to-end suite is 14 smoke tests.
- **Not measured:** coverage isn't measured; `@vitest/coverage-v8` isn't installed.

**7. Changes are large and unreviewed.**
- **Size:** the median commit touches 21 files, and one feature commit touches 240.
- **Bundling:** single commits bundle several features ("E-signatures, candidate self-service, interview self-booking, merging duplicates").
- **No review:** everything lands on `main` with no branch or pull request. CI runs on push, after the fact.

**Nothing in the current code reads as junior.** The junior-level gaps the 4 October audit found have been closed:
- no CI;
- 9 copies of a timing-safe comparison;
- errors only in console logs;
- no tenant check.

---

## How the code has moved since 4 October

| Earlier finding (`code-audit.md`) | Now |
|---|---|
| C1 critical Next.js advisory | Fixed (16.3.8) |
| C2 no CI | Fixed: lint, types, tests, migration check, build and end-to-end tests on every push and pull request. Branch protection can't be confirmed from the repo |
| C3 tenant isolation by hand, no test | Fixed: a ratchet test, a fake-database isolation test, and database-level RLS behind a switch (`SUPABASE_AGENCY_RLS`, off by default) |
| C4 migrations by hand | Fixed: gated workflow. `supabase/manual/` still exists |
| C5 obfuscation breaks Sentry source maps | **Open:** `postbuild` still obfuscates after the maps are uploaded |
| C6 errors don't reach anyone | Fixed: `reportError`, 245 uses |
| C7 682 KB shared bundle | Improved: Replay and analytics load after consent |
| C8 no type checking | Partly: `checkJs` with a baseline ratchet; still `strict: false` and no typed contracts |
| C9 copy-pasted security helper | Fixed: 1 copy of the timing-safe compare and 1 of `escapeHtml`. `formatDate` still has 8 |
| C10 documentation | Improved: `docs/architecture.md`, `docs/runbook.md`, a real README |
| C11 very large files | Improved: none over 1,000 lines (was 8); 28 over 500 |
| C14 design-system fragmentation | Improved: one kit; a ratchet on hex colours, inline styles and font sizes |

The trajectory matters for the rating. On 4 October the machinery around the code was junior-level; it's now senior-level. The ordinary feature code hasn't been restructured yet, which is why the overall rating stops at "edge of senior".

---

## What to do to reach senior, then staff

Priority = (Impact + Risk) × (6 − Effort). Each is scored 1 to 5; for effort, 1 is under a day, 3 about a week and 5 a month or more.

| # | Change | I | R | E | Priority |
|---|---|---|---|---|---|
| D1 | Turn on database-level agency separation in production. Make it the default for new environments after a staging soak | 4 | 5 | 2 | **36** |
| D2 | Fix obfuscation vs Sentry (C5): drop the step, or upload maps after it | 3 | 3 | 1 | **30** |
| D3 | Small commits through pull requests, with branch protection requiring CI | 2 | 3 | 1 | **25** |
| D4 | Field-level request schemas: replace `JsonObject` on the 50 routes and move the 65 hand-read bodies onto the wrapper. One strict schema per route, unknown keys stripped | 3 | 4 | 3 | **21** |
| D5 | Route tests with `fakeDb` for billing, invoices, team roles, erasure and the analysis run | 3 | 4 | 3 | **21** |
| D6 | Delete the 14 "table missing" fallbacks (`42P01`/`PGRST205`) once the admin migrations are confirmed applied | 2 | 2 | 1 | **20** |
| D7 | Measure coverage in CI (report only, no gate) | 2 | 2 | 1 | **20** |
| D8 | Split the god handlers: `run` into named pipeline steps in `lib/`, and the `admin/users` operations into `lib/admin/` | 3 | 3 | 3 | **18** |
| D9 | Typed contracts at the boundary: TypeScript (or `strict` JSDoc) for `lib/api`, `lib/api-client` and the response shapes, starting with candidates, jobs and billing | 4 | 3 | 4 | **14** |
| D10 | Group `lib/`'s 129 top-level modules into domain folders | 2 | 1 | 2 | **12** |
| D11 | Server-first loading for the remaining 28 dashboard pages, or a small fetch-cache hook; reducers for the 20+-`useState` components | 3 | 2 | 4 | **10** |
| D12 | Trim the 130 "used to…" comments as files are touched | 1 | 1 | 2 | **8** |

**Phased alongside feature work:**
1. **This week:** D1, D2, D3, D6, D7. Each is a day or less, and together they close the remaining risk.
2. **Next month:** D4 and D5 together, area by area (validate and test each route in the same change). Then D8.
3. **This quarter:** D9, starting with the API boundary, plus D10 and D11 as files are touched.

### Fix status (11 October)

All twelve are done in code. Three need a setting changed outside the repo before they take full effect (marked **needs you**).

| # | Status | Commit | What changed |
|---|---|---|---|
| D1 | Done in code, **needs you** | `f70d7b1` | Database-level separation is on by default, behind a probe: every 5 minutes it checks that the agency-scoped client really sees only its own agency, and falls back to the service-role client if not. Production keeps falling back until the `agency_member_rls` and `audit_fixes` migrations are applied (Actions → Apply database migrations) and `SUPABASE_JWT_SECRET` is set in Vercel |
| D2 | Done in code, **needs you** | `8fd5270` | Source maps are composed through the obfuscation step and uploaded after it, with Sentry debug IDs. Uploading needs `SENTRY_AUTH_TOKEN` in the Vercel build environment |
| D3 | Done in the repo, **needs you** | `22ec2e9` | `CONTRIBUTING.md`, a pull request template, and a CI job that warns on a pull request over 40 files or 1,000 lines. Protecting `main` so CI must pass is a repository setting; the steps are in the runbook |
| D4 | Done | `ca58eb3` | Every route that reads a JSON body reads it through a schema naming its fields (`lib/api/schemas.js`); unknown keys are dropped. Webhooks keep reading the raw body for signature checks, and uploads read form data. `test/request-schemas.test.js` keeps it that way |
| D5 | Done | `103d69c` | Route tests against the in-memory database for billing, invoices, team roles, erasure and the screening run |
| D6 | Done | `b1163cb` | The 14 "table missing" fallbacks are gone (the admin tables were confirmed in production first) |
| D7 | Done | `0c1a3b4` | CI reports coverage on every run, with no threshold |
| D8 | Done | `741c522` | `POST /api/run` is 97 lines over named steps in `lib/screening/`; the user operations of `admin/users` live in `lib/admin/users.js` |
| D9 | Done for candidates, jobs and billing | `d180f0d` | Response contracts in `lib/contracts/` type both the server code that builds a response and the client call that reads it, and `app/api/contracts.test.js` checks real responses against them. `lib/contracts`, `lib/api` and `lib/api-client` type-check in strict mode with no allowed errors. Other responses move onto contracts as they're touched |
| D10 | Done | `ecf1abf` | 117 of 133 top-level `lib/` modules are in domain folders; 16 shared ones stay at the top (map in `architecture.md`) |
| D11 | Done for the hook and the worst component | `4dd54f5` | `useResource` (a keyed, session-cached loader) on 9 dashboard pages, 2 profile cards and /analyse; /analyse's 29 `useState` calls are one tested reducer. The 27 in `candidate-extras.jsx` turned out to be six small cards, not one component, so they didn't need a reducer. The remaining pages move onto the hook as they're touched |
| D12 | Done | `a1f62e3`, `d09f873`, `ff5d423` | 149 history comments rewritten to give the current behaviour and its reason (127 found by search, 22 more found while doing it). What still matches "no longer" describes behaviour now (an expired demo no longer grants access) |

With D1 to D9 done, the API and front-end areas read senior, and the overall rating moves to **senior**. The step to **staff** is less about code and more about system shape:
- typed contracts end to end;
- domain services other features build on;
- quality measured and gated (coverage, scoring evals in CI);
- architecture decisions recorded as ADRs.

---

## Reproducing the numbers

Run from `helixon-app/` at `03ecaf2`:

```bash
# Routes and how they start
find app/api -name route.js | wc -l                                  # 196
grep -rl 'customerRoute(' app/api | wc -l                            # 79
grep -rhoE "body: [A-Z]\w+" app/api | sort | uniq -c                 # 50 JsonObject
grep -rl 'request.json()' app/api | wc -l                            # 65

# Where queries live
grep -rho '\.from("' app/api | wc -l                                 # 587
grep -rho '\.from("' lib | wc -l                                     # 260

# Front end
grep -rl '^"use client"' app components | wc -l                      # 228
grep -rho 'useState(' app components | wc -l                         # 1133
grep -rl 'createContext(' app components lib | wc -l                 # 0

# Error reporting
grep -rho 'reportError(\|reportQuietly(' app lib components | wc -l  # 245
grep -rhoE 'console\.(error|warn)\(' app lib components | wc -l      # 28

# Schema (from supabase/migrations/)
cat *.sql | grep -ic 'check ('                                       # 193
cat *.sql | grep -ic 'create index'                                  # 89

# Commit size
git log --format=%h | while read h; do git show --stat --format= $h | tail -1; done
```
