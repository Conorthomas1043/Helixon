# Contributing to Helixon

The app lives in `helixon-app/`. Read [`docs/architecture.md`](docs/architecture.md) first, especially the section on tenant isolation, and keep [`docs/runbook.md`](docs/runbook.md) to hand for migrations and releases.

## Working on a change

1. **Branch from `main`.** Name it after the change: `fix/invoice-rounding`, `feat/interview-reminders`.
2. **Keep it small.** One change per pull request: a fix, a feature or a refactor, not all three. As a guide, under about 400 changed lines and 20 files. CI flags a pull request that's much bigger. Split a large feature into steps that each leave `main` working, behind a setting if need be.
3. **Run the checks locally** from `helixon-app/`:
   ```
   npm run check    # lint, type checks, unit tests, migration names
   ```
   For a page change, also run `npm run build && npm run test:e2e`, and try it in the browser.
4. **Open a pull request.** The template asks what changed, why, and how it was checked. CI must pass before it can merge: "Lint, types, tests" and "Production build and e2e".
5. **Merge** once CI is green and the change has been reviewed. Vercel deploys `main` to production.

## Conventions that CI enforces

- **Request bodies** go through a schema that names each field (`lib/api/schemas.js`, `customerRoute` or `parseBody`).
- **Responses with a contract** (`lib/contracts/`) are built by a typed function and checked by `app/api/contracts.test.js`.
- **`lib/contracts`, `lib/api` and `lib/api-client`** type-check in strict mode with no errors.
- **Elsewhere in `lib/`**, a file may lose type errors but never gain them (`scripts/typecheck-baseline.json`).
- **Queries on agency data** are scoped to the member's agency (`lib/security/tenant-isolation.test.js`, `app/api/agency-isolation.test.js`).
- **Styles:** no hex colours, inline styles or one-off font sizes outside the design tokens (`test/design-tokens.test.js`).
- **Migrations:** file names are unique and ordered.

## Conventions by review

- **Comments** say what the code does and why, not what it used to do. History belongs in the commit message.
- **Pages** load their data on the server where they can. Otherwise they use `useResource` (`lib/use-resource.js`), not a hand-written `useEffect` fetch.
- **State with many related fields** goes in a reducer with named actions and its own tests.
- **New logic** goes in `lib/`, with tests next to it. Route handlers stay thin.
- **Errors** reach `reportError()` (Sentry), not only `console.error`.

## Commit messages

A short summary line (under about 70 characters, imperative: "Add …", "Fix …"), a blank line, then what changed and why. Mention anything someone deploying it needs to do, such as a migration or a new environment variable.
