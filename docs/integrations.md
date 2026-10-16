# Helixon: turning on integrations

Each integration is off until its environment variables are set in Vercel (Project → Settings → Environment Variables) and production is redeployed. Set every variable in a feature's row or none: a half-set feature is reported at startup (`lib/env.js`) and stays off.

Callback and webhook addresses below use the production site, `https://www.helixon.co.uk`. If `NEXT_PUBLIC_SITE_URL` is different, use that instead.

| Feature | Variables | Rough cost (October 2026) |
|---|---|---|
| Texting (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`); optional `SMS_ALLOWED_COUNTRY_CODES` | About 3.5p per UK text segment, plus monthly number rental |
| Email replies filed on candidates (Resend inbound) | `RESEND_INBOUND_DOMAIN`, `RESEND_WEBHOOK_SECRET` | Received mail counts against the Resend plan's monthly quota |
| Staff Google Calendar | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Free |
| Outlook mailbox sync | `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`; optional `OUTLOOK_TENANT` | Free |
| Gmail mailbox sync | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | Free API, but Google requires a yearly third-party security assessment (CASA) for the mailbox-reading permission: from about $540 a year, plus 2-8 weeks |
| Xero | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Free for the first 5 connected organisations, then tiered |
| QuickBooks | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`; `QUICKBOOKS_ENVIRONMENT=sandbox` only while testing | Free Builder tier covers normal use |
| Embedding match in scoring (Voyage AI) | `VOYAGE_API_KEY` | About $0.06 per million tokens after 200 million free |
| Readable Sentry stack traces | `SENTRY_AUTH_TOKEN` (build only) | Free with the existing Sentry account |

Xero, QuickBooks, Gmail and Outlook store OAuth tokens, encrypted with `INTEGRATIONS_ENCRYPTION_KEY` (`lib/security/secret-box.js`). Without that key they show as not set up. **Never change the key once anything is connected:** tokens sealed with the old key can't be opened, and every connection has to be made again.

## Texting (Twilio)

1. In the Twilio console, buy a UK number that can receive SMS. A one-way alphanumeric sender can't receive replies, and Helixon files replies on the candidate.
2. On the number, set **A message comes in** to `POST https://www.helixon.co.uk/api/webhooks/twilio`. Delivery updates come back to the same address. Twilio signs every request and the route checks the signature with `TWILIO_AUTH_TOKEN`.
3. In Twilio → Messaging → Settings → **Geo permissions**, allow only the countries you text (the UK). This is the second guard against SMS-pumping fraud; the app also refuses countries outside `SMS_ALLOWED_COUNTRY_CODES` (default: the UK).
4. Set the variables and redeploy.

Only workspaces with an active subscription can text, at most 200 texts an hour per recruiter, and never to a number that has replied STOP.

## Email replies filed on candidates (Resend inbound)

1. In Resend, add a receiving domain, e.g. `reply.helixon.co.uk`, and add the MX record Resend shows to your DNS.
2. Add a webhook for the **email.received** event pointing at `https://www.helixon.co.uk/api/webhooks/resend-inbound`, and copy its signing secret.
3. Set `RESEND_INBOUND_DOMAIN` (the receiving domain) and `RESEND_WEBHOOK_SECRET`, and redeploy.

Emails sent from Helixon then carry a `reply+<token>@` Reply-To. Replies appear on the candidate's thread and are forwarded to the recruiter. Each member also gets a `log+<token>@` BCC address (Settings → Calendar & email) to file emails sent from their own inbox, Gmail included, without a mailbox integration.

## Staff Google Calendar

1. Google Cloud console → a project → **APIs & Services**: enable the **Google Calendar API**.
2. OAuth consent screen: if Helixon's staff all use your own Google Workspace, choose **Internal** (no Google review). Otherwise choose **External** and submit it for verification: the calendar permission is "sensitive", which is free but takes days to weeks.
3. Credentials → OAuth client ID → Web application. Authorised redirect URI: `https://www.helixon.co.uk/api/employee/calendar/google/callback`.
4. Set the two variables and redeploy. Staff connect from the portal's Calendar page.

## Outlook mailbox sync

1. Azure portal → Microsoft Entra ID → **App registrations** → New registration. Supported account types: any organisational directory and personal Microsoft accounts (or one tenant, then set `OUTLOOK_TENANT` to its id).
2. Redirect URI (Web): `https://www.helixon.co.uk/api/integrations/oauth/outlook/callback`.
3. API permissions → Microsoft Graph, delegated: `offline_access`, `openid`, `email`, `User.Read`, `Mail.Read`.
4. Certificates & secrets → New client secret. Its value goes in `OUTLOOK_CLIENT_SECRET`; the Application (client) id goes in `OUTLOOK_CLIENT_ID`.
5. Optional but recommended: complete **publisher verification** (free), so customers see a verified publisher on the consent screen.

## Gmail mailbox sync

The app asks for `gmail.readonly`, a restricted permission. Before anyone outside your own Google account can connect, Google requires app verification and a yearly CASA security assessment by an approved lab. Do it only when customers ask for it; the BCC address above covers logging sent mail for free.

1. Google Cloud console: enable the **Gmail API**.
2. OAuth client (Web application), redirect URI `https://www.helixon.co.uk/api/integrations/oauth/gmail/callback`.
3. Submit the consent screen for verification and book the CASA assessment.
4. Set the two variables and redeploy.

## Xero

1. developer.xero.com → My Apps → New app (Web app). Redirect URI: `https://www.helixon.co.uk/api/integrations/oauth/xero/callback`.
2. Copy the client id and generate a secret.
3. Set the variables and redeploy. An owner or admin connects it from Settings → Integrations.

Scopes requested: `openid profile email offline_access accounting.transactions accounting.contacts` (override with `XERO_SCOPES` if Xero changes its scope names).

## QuickBooks

1. developer.intuit.com → create an app (QuickBooks Online and Payments). Redirect URI: `https://www.helixon.co.uk/api/integrations/oauth/quickbooks/callback`.
2. To try it, use the development keys with `QUICKBOOKS_ENVIRONMENT=sandbox`. Production keys need Intuit's app assessment; then switch to them and remove `QUICKBOOKS_ENVIRONMENT` (unset means the live QuickBooks API).
3. Set the variables and redeploy.

## Voyage AI

Adds an embedding-similarity signal to CV scoring (`lib/cv-analysis/scoring/embeddingMatcher.js`). Scoring works without it. Voyage would be a new subprocessor of candidate data, so add it to the privacy policy (`app/privacy`) and the DPA subprocessor list (`app/dpa`) **before** setting `VOYAGE_API_KEY`.

## Sentry source maps

Sentry → Settings → Auth Tokens → create an organisation token with the release and source-map scopes. Set `SENTRY_AUTH_TOKEN` for the build. The build uploads maps and then deletes them from the public output (`scripts/obfuscate-build.mjs`).
