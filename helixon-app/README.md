# Helixon app

AI CV screening and a recruitment CRM for agencies. Next.js (App Router) on Vercel, Clerk for customer sign-in, Supabase Postgres for data, Stripe for billing.

- **How it fits together:** [`docs/architecture.md`](../docs/architecture.md)
- **Deploying, migrations, incidents:** [`docs/runbook.md`](../docs/runbook.md)
- **Product vocabulary:** [`docs/glossary.md`](../docs/glossary.md)

## Getting started

```bash
cp .env.example .env.local   # fill in at least the Supabase and Clerk keys
npm install
npm run dev                  # http://localhost:3000
```

Read `AGENTS.md` before changing framework code: this Next.js version differs from older docs, and its own guides are in `node_modules/next/dist/docs/`.

## Checks

CI (`.github/workflows/ci.yml`) runs these on every push and pull request. Run them before pushing:

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint (Next.js core-web-vitals rules) |
| `npm run typecheck` | Types in `lib/` and the `.ts` files. Existing errors are listed in `scripts/typecheck-baseline.json`; a file may lose errors but never gain them |
| `npm test` | Vitest unit tests, including the tenant-isolation guard (`lib/security/tenant-isolation.test.js`) |
| `npm run build` | Production build |

## Scoring evaluation

`npm run eval:cv`, `eval:labelled`, `calibrate` and `eval:fairness` exercise the CV scoring pipeline against sample and labelled data. They call the AI APIs, so they need keys and cost money. Run them when changing `lib/cv-analysis`.
