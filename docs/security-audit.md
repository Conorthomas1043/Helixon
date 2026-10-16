# Helixon: security audit of authentication, authorisation and user input

**Scope:** `helixon-app` at `e7c4f05`: the proxy, every auth and session library (Clerk customers, admin console, staff portal, API keys, cron and internal secrets, webhooks, database-level agency separation), and all ~200 API route handlers, classified by guard, with the high-risk ones read in full. Also outbound requests, uploads, LLM prompts, email and CSV output, and the front end's link and HTML rendering. Read from the code; no live testing.

**Overall:** the authentication core is sound, and no query was found that returns another agency's rows. The findings were an abuse path (free workspaces using Helixon's messaging), gaps in the two in-workspace permissions, and secrets kept where they shouldn't be.

## Fix status

All fixed in code on 16 October 2026 (commits `9af1768` to `1197e62`), except where noted. Lint, typecheck, 787 unit tests, the production build and 38 end-to-end tests passed before pushing.

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | Anyone could get a free workspace (sign-up's paywall was browser-only), then send email and SMS through Helixon's Resend and Twilio, mostly unrate-limited | Fixed: `checkoutClaim` before any workspace is created; `sendAgencyEmail` needs a subscription and caps each agency at 1,000 emails an hour; texting needs a subscription and an allowed country; import needs a subscription |
| 2 | Medium | "Own candidates only" not applied to compliance, bulk email (and its preview), e-signatures, sequence enrolment, placement detail | Fixed |
| 3 | Medium | "Financials admin-only" bypassed by the public API (keys outlived their maker's admin role), offer/contract text, and the candidate data export | Fixed |
| 4 | Medium | Private-link tokens stored in request logs (path, referer, redirect) and firewall alert emails | Fixed; migration `20261016000000` scrubbed stored rows |
| 5 | Low | Staff session tokens and Google Calendar OAuth tokens stored in plain text | Fixed: sessions stored as SHA-256; Google tokens sealed with `INTEGRATIONS_ENCRYPTION_KEY`. **Not changed:** private-link tokens (shares, portal, signing, booking...) stay as they are, because the app shows the links again after creating them |
| 6 | Low | Admin two-factor optional; legacy SHA-256 password hashes accepted | Configuration: TOTP secrets, `ADMIN_REQUIRE_2FA` and bcrypt hashes set in Vercel on 16 October (live after the next redeploy). Legacy hashes are still accepted but reported |
| 7 | Low | Client and deal owner ids not checked, revealing other agencies' members' names | Fixed |
| 8 | Low | Candidate-supplied LinkedIn values rendered as raw links | Fixed |
| 9 | Low | Staff login lockout by username; limiter failed open | Fixed |
| 10 | Low | No decompression bound on DOCX uploads; no size check on the job spec file | Fixed. **Not covered:** PDFs (PDF.js has no hook to bound decompression) |
| 11 | Low | Password change left other sessions signed in | Fixed for `/api/account/password` |
| 12 | Low | Any member could permanently erase 500 candidates per request | Fixed: bulk delete is for owners and admins |
| 13 | Low | Client-supplied sign-up `plan` stored unchecked | Fixed |
| 14 | Info | Cron auth copied 6 times; site-gate compare and limiter; scorecard links never expired; feedback links indexable and unthrottled; suspended agencies' links kept working; members saw pending invite emails | Fixed |

## Found while applying the fixes

- `CRON_SECRET` wasn't set, so every scheduled job (data retention among them) had been refusing to run. Set in Vercel on 16 October; live after the next redeploy.
- The "Apply database migrations" workflow has never worked; see the runbook's Database migrations section.
- Supabase's security advisor reports only the expected "RLS enabled, no policy" notices (the service-role design), nothing at warning level.

## Still to do

- Remove unused Vercel variables: `ADMIN_KEY` (the old permanent admin key), `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
- Check `ADMIN_USERS` lists exactly the current admins, and `ADMIN_SESSION_SECRET` is 32+ random characters.
- Apply migration `20261016010000_remove_unhashed_employee_sessions` (deletes expired staff sessions from before hashing).
- Hash private-link tokens, which needs the app to stop showing links after creating them.
