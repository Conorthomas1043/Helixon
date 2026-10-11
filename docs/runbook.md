# Helixon: runbook

Day-to-day operations for `helixon-app`. Architecture background is in [`architecture.md`](architecture.md).

## Shipping a change

1. Open a pull request from a branch ([`CONTRIBUTING.md`](../CONTRIBUTING.md)). CI runs lint, both type checks, unit tests with coverage, the migration-name check, a production build and the end-to-end tests, and notes the pull request's size.
2. Merge when CI is green and the change is reviewed. Vercel deploys `main` to production automatically.
3. If the change adds a migration, apply it (next section) **before** the code that needs it is relied on.

### Protecting `main` (one-off, by a repository admin)

This is what makes CI a gate instead of a report.
1. Go to GitHub → the repository → **Settings** → **Rules** → **Rulesets** → **New branch ruleset**. (Classic alternative: Settings → Branches → Add rule.)
2. Name it `main`, set **Enforcement** to *Active*, and add the target **Include default branch**.
3. Tick these rules:
   - **Restrict deletions** and **Block force pushes**.
   - **Require a pull request before merging**. With a second engineer, also set **Required approvals** to 1.
   - **Require status checks to pass**, adding `Lint, types, tests` and `Production build and e2e`. Tick **Require branches to be up to date before merging**.
4. Leave the bypass list empty, or add only the admin role for emergencies.

Once it's on, every change reaches `main` through a pull request with green checks.

## Database migrations

New schema changes go in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` (`supabase migration new <name>` creates one).

To apply them:
1. One-off setup: add a repository secret `SUPABASE_DB_URL` with the production Postgres connection string (Supabase dashboard → Connect → Session pooler).
2. GitHub → Actions → **Apply database migrations** → Run workflow. Leave **dry run** ticked first: it lists which migrations are applied and which are pending.
3. Run it again with dry run unticked to apply the pending ones.

Never paste migration SQL into the dashboard editor: the migration history then no longer matches the database, and `db push` will try to apply it again. `supabase/manual/` holds the one historical script that had to be run by hand.

## Database-level agency separation

Customer API routes query agency tables through `lib/agency-db.js`. With `SUPABASE_JWT_SECRET` set, those queries run as the `agency_member` database role with a token the server signs for the member's agency, and Postgres refuses any other agency's rows even if a query forgets its `agency_id` filter. Browsers can't obtain that token, so the Supabase REST API stays closed to them.

It's on by default whenever the secret is set. Before using it, the server probes that the database really enforces it (a token for an unknown agency must see no rows), re-checking every five minutes. If the probe fails, queries use the service-role client with the app's own filters, Sentry gets one `[agency-db]` error, and `/admin/health` shows **Agency separation** as not working. `/admin/health` always shows the current state.

To turn it on in an environment:
1. Apply migration `20261005000000_agency_member_rls.sql` (the migrations workflow above).
2. In the Supabase SQL editor, check no rows would be hidden: `select * from public.agency_rls_readiness() where rows_without_agency > 0;` must return nothing. Fill in any `agency_id`s it reports first.
3. In Vercel, add `SUPABASE_JWT_SECRET` (Supabase → Project Settings → JWT Keys → legacy JWT secret) and `SUPABASE_ANON_KEY` if it isn't set, and redeploy. (Leave `SUPABASE_AGENCY_RLS` unset.)
4. Check `/admin/health` shows Agency separation working, then smoke-test the dashboard, a candidate profile, jobs, clients and placements. Errors mentioning `row-level security` or `permission denied` in Sentry mean a query needs looking at.

To switch it off, set `SUPABASE_AGENCY_RLS=0` and redeploy. The migration can stay.

After adding a table with an `agency_id` column, re-run the migration's policy block (or the whole migration, which is safe to repeat) so the new table gets the policy.

## Checking the AI-writing flag

- **Measure accuracy:** `ANTHROPIC_API_KEY=... npm run eval:ai-writing -- --yes`. It runs the check on `scripts/eval-samples/ai-writing.json` and reports precision, recall and false alarms, per group. That file is a synthetic starter set; add real CVs you're permitted to use, labelled `ai` or `human`. If false alarms on human CVs are more than rare, especially for non-native English writers, raise the bar in `lib/screening/ai-writing.js` or switch the notice off.
- **Real-world answers:** recruiters' "Does this look right?" answers are in `research_signals` with `kind = 'ai_writing_feedback'` (label `right` or `wrong`). They need migration `20261011000000_ai_writing_feedback` applied.
- **Volume:** the `cv_ai_writing_checked` analytics event (per screening, by agency) shows how often the flag fires.

## Environment variables

`helixon-app/.env.example` lists every variable, with comments. Set them in Vercel (Project → Settings → Environment Variables). The app needs at least Supabase, Clerk, Stripe and Resend to work. AI, Redis and integration keys switch individual features on.

## When something breaks

1. **See it.** Sentry gets unhandled errors, route-level crashes (`error.js` boundaries) and handled API errors (`reportError`). Each event is tagged with the route's `[scope]`. Vercel → Logs has the raw request log. `/admin/health` shows the state of each external service.
   - Browser stack traces need `SENTRY_AUTH_TOKEN` in the Vercel build environment. The build uploads maps for shared chunks; `scripts/obfuscate-build.mjs` uploads maps for the obfuscated app chunks after obfuscating them, then deletes every client map so none is public. Its build-log lines start `[obfuscate-build]`.
2. **Contain it.**
   - Site-wide problem: switch on **Maintenance mode** at `/admin/site`. Admins and staff can still get in.
   - A bad deploy: Vercel → Deployments → the previous good deployment → **Promote to production**. This takes seconds and needs no code change.
   - A misbehaving cron: remove or comment its entry in `vercel.json` and deploy, or roll back as above.
   - Abuse from an IP: block it from `/admin/security`.
3. **Fix forward** through a pull request, so CI checks the fix.
4. **Afterwards:** write down what happened, how it was noticed and what will stop it recurring.

A user reporting "This page didn't load" may quote a code: that is the error digest, searchable in Sentry and Vercel logs.

## Routine jobs

- **Dependabot** opens weekly dependency PRs. Merge them when CI is green; take major versions one at a time.
- **Scoring changes:** run `npm run eval:cv` and `npm run eval:fairness` (needs API keys, costs about £20) before merging changes to `lib/cv-analysis`.
- **Type backlog:** after fixing type errors, run `npm run typecheck -- --update` so the baseline drops.
- **Tenant baseline:** if you remove unfiltered queries, regenerate it with `UPDATE_TENANT_BASELINE=1 npx vitest run lib/security/tenant-isolation.test.js`.
