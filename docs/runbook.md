# Helixon: runbook

Day-to-day operations for `helixon-app`. Architecture background is in [`architecture.md`](architecture.md).

## Shipping a change

1. Open a pull request (or push to a branch). CI runs lint, the type-check ratchet, unit tests, the migration-name check and a production build.
2. Merge when CI is green. Vercel deploys `main` to production automatically.
3. If the change adds a migration, apply it (next section) **before** the code that needs it is relied on.

Recommended repository setting: protect `main` (Settings → Branches) so it only accepts merges with the `CI` checks passing.

## Database migrations

New schema changes go in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` (`supabase migration new <name>` creates one).

To apply them:
1. One-off setup: add a repository secret `SUPABASE_DB_URL` with the production Postgres connection string (Supabase dashboard → Connect → Session pooler).
2. GitHub → Actions → **Apply database migrations** → Run workflow. Leave **dry run** ticked first: it lists which migrations are applied and which are pending.
3. Run it again with dry run unticked to apply the pending ones.

Never paste migration SQL into the dashboard editor: the migration history then no longer matches the database, and `db push` will try to apply it again. `supabase/manual/` holds the one historical script that had to be run by hand.

Some routes still fall back when a column is missing (Postgres error `42703`). Once every migration is confirmed applied in production, those fallbacks can be removed.

## Switching on database-level agency separation

Customer API routes query agency tables through `lib/agency-db.js`. While it is off (the default), that is the service-role client, as before. Switched on, those queries run as the `agency_member` database role with a token the server signs for the member's agency, and Postgres refuses any other agency's rows even if a query forgets its `agency_id` filter. Browsers can't obtain that token, so the Supabase REST API stays closed to them.

1. Apply migration `20261005000000_agency_member_rls.sql` (the migrations workflow above).
2. In the Supabase SQL editor, check no rows would be hidden: `select * from public.agency_rls_readiness() where rows_without_agency > 0;` must return nothing. Fill in any `agency_id`s it reports first.
3. In Vercel, add `SUPABASE_JWT_SECRET` (Supabase → Project Settings → JWT Keys → legacy JWT secret) and `SUPABASE_ANON_KEY` if it isn't set, then `SUPABASE_AGENCY_RLS=1`, and redeploy.
4. Smoke-test the dashboard, a candidate profile, jobs, clients and placements. Errors mentioning `row-level security` or `permission denied` in Sentry mean a query needs looking at.

To switch off, remove `SUPABASE_AGENCY_RLS` and redeploy. The migration can stay.

After adding a table with an `agency_id` column, re-run the migration's policy block (or the whole migration, which is safe to repeat) so the new table gets the policy.

## Environment variables

`helixon-app/.env.example` lists every variable, with comments. Set them in Vercel (Project → Settings → Environment Variables). The app needs at least Supabase, Clerk, Stripe and Resend to work. AI, Redis and integration keys switch individual features on.

## When something breaks

1. **See it.** Sentry gets unhandled errors, route-level crashes (`error.js` boundaries) and handled API errors (`reportError`). Each event is tagged with the route's `[scope]`. Vercel → Logs has the raw request log. `/admin/health` shows the state of each external service.
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
