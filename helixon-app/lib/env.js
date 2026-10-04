// Every environment variable the server needs, in one place, checked once
// when the server starts (instrumentation.js). A missing or malformed value
// used to show up only when the feature that reads it was first used - an
// email that silently didn't send, a webhook rejected - and in whichever of
// the 70-odd files read it. Now the deploy's logs (and Sentry) list what's
// wrong at boot. .env.example documents each one.
//
// The check reports; it never stops the server. A missing optional
// integration only disables that integration, and taking the whole site down
// over one bad value would be worse than the feature failing.

const hex64 = (v) => /^[0-9a-f]{64}$/i.test(v) || Buffer.from(v, "base64").length === 32;
const url = (v) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};
const number = (v) => Number.isFinite(Number(v));

// Needed for the product to work at all. In production, any missing one is
// an error.
export const REQUIRED = [
  { name: "SUPABASE_URL", alt: "NEXT_PUBLIC_SUPABASE_URL", check: url, what: "the database" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", what: "the database" },
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", what: "sign-in" },
  { name: "CLERK_SECRET_KEY", what: "sign-in" },
  { name: "CLERK_WEBHOOK_SECRET", what: "new accounts (Clerk webhook)" },
  { name: "ANTHROPIC_API_KEY", what: "CV screening" },
  { name: "STRIPE_SECRET_KEY", what: "billing" },
  { name: "STRIPE_WEBHOOK_SECRET", what: "billing (Stripe webhook)" },
  { name: "STRIPE_PRICE_INDIVIDUAL", what: "billing" },
  { name: "STRIPE_PRICE_AGENCY", what: "billing" },
  { name: "RESEND_API_KEY", what: "email" },
  { name: "RESEND_FROM_EMAIL", what: "email" },
  { name: "NEXT_PUBLIC_SITE_URL", check: url, what: "links in emails and OAuth redirects" },
  { name: "CRON_SECRET", what: "scheduled jobs" },
  { name: "ADMIN_SESSION_SECRET", what: "the admin portal" },
];

// Worth having; without them something degrades rather than breaks.
export const RECOMMENDED = [
  { name: "REDIS_URL", alt: "UPSTASH_REDIS_REDIS_URL", what: "rate limiting (falls back to per-instance memory)" },
  { name: "INTERNAL_EDGE_LOG_SECRET", what: "request logging for admin Traffic" },
  { name: "SECURITY_ALERT_EMAIL", what: "firewall alerts" },
];

// Features that need several variables: all or none. Half a set is a
// mistake (a client id without its secret), so it's reported.
export const GROUPS = [
  { feature: "Google Calendar sync", names: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"] },
  { feature: "Xero", names: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"] },
  { feature: "QuickBooks", names: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"] },
  { feature: "Gmail sync", names: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"] },
  { feature: "Outlook sync", names: ["OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET"] },
  { feature: "Texting (Twilio)", names: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] },
  { feature: "Email replies (Resend inbound)", names: ["RESEND_INBOUND_DOMAIN", "RESEND_WEBHOOK_SECRET"] },
  { feature: "Site gate", names: ["SITE_GATE_PASSWORD", "SITE_GATE_SECRET"] },
];

// Values that are only right in one shape.
export const FORMATS = [
  { name: "INTEGRATIONS_ENCRYPTION_KEY", check: hex64, hint: "32 random bytes as 64 hex characters (openssl rand -hex 32) or base64" },
  { name: "ADMIN_LOGIN_SLUG", check: (v) => /^[A-Za-z0-9_-]{8,}$/.test(v.replace(/^\/+|\/+$/g, "")), hint: "8+ letters, digits, - or _ (otherwise the default /admin/login stays)" },
  { name: "FIREWALL_BLOCK_THRESHOLD", check: number, hint: "a number" },
  { name: "FIREWALL_ALERT_THRESHOLD", check: number, hint: "a number" },
  { name: "SUPABASE_AGENCY_RLS", check: (v) => v === "1" || v === "0", hint: '"1" to switch on, otherwise leave unset' },
];

const OAUTH_INTEGRATIONS = ["XERO_CLIENT_ID", "QUICKBOOKS_CLIENT_ID", "GMAIL_CLIENT_ID", "OUTLOOK_CLIENT_ID"];

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ production?: boolean }} [options]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkEnv(env = process.env, { production = env.NODE_ENV === "production" } = {}) {
  const has = (name) => typeof env[name] === "string" && env[name].trim() !== "";
  const value = (name) => (env[name] ?? "").trim();
  const errors = [];
  const warnings = [];

  for (const v of REQUIRED) {
    const name = has(v.name) ? v.name : v.alt && has(v.alt) ? v.alt : null;
    if (!name) (production ? errors : warnings).push(`${v.name} is not set - needed for ${v.what}.`);
    else if (v.check && !v.check(value(name))) errors.push(`${name} doesn't look right - needed for ${v.what}.`);
  }
  for (const v of RECOMMENDED) {
    if (production && !has(v.name) && !(v.alt && has(v.alt))) warnings.push(`${v.name} is not set - ${v.what}.`);
  }
  for (const g of GROUPS) {
    const set = g.names.filter(has);
    if (set.length && set.length < g.names.length) {
      errors.push(`${g.feature} is half set up: ${g.names.filter((n) => !has(n)).join(", ")} missing.`);
    }
  }
  if (has("TWILIO_ACCOUNT_SID") && !has("TWILIO_FROM_NUMBER") && !has("TWILIO_MESSAGING_SERVICE_SID")) {
    errors.push("Texting (Twilio) needs TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
  }
  for (const f of FORMATS) {
    if (has(f.name) && !f.check(value(f.name))) errors.push(`${f.name} should be ${f.hint}.`);
  }
  if (OAUTH_INTEGRATIONS.some(has) && !has("INTEGRATIONS_ENCRYPTION_KEY")) {
    errors.push("INTEGRATIONS_ENCRYPTION_KEY is not set, so the integrations that are configured can't store their tokens.");
  }
  if (value("SUPABASE_AGENCY_RLS") === "1" && !has("SUPABASE_JWT_SECRET")) {
    errors.push("SUPABASE_AGENCY_RLS is on but SUPABASE_JWT_SECRET is not set, so database-level separation stays off.");
  }
  return { errors, warnings };
}
