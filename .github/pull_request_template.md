## What changes

<!-- One change per pull request. What does it do, for whom? -->

## Why

<!-- The problem it solves, or the audit item / issue it closes. -->

## How it was checked

- [ ] `npm run check` passes (lint, types, unit tests, migration names)
- [ ] New behaviour has a test (route tests use `test/fake-db.js`)
- [ ] Tried in the browser, if it changes a page

## Before merging

- [ ] Adds a migration? It's in `supabase/migrations/`, and the plan for applying it is below
- [ ] Needs an environment variable? Named below, and added to Vercel first
- [ ] Touches tenant data? Every query is scoped to the member's agency

<!-- Migration / environment / rollout notes, if any. -->
