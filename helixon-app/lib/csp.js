// Content-Security-Policy, set on every page by proxy.ts with a fresh nonce.
//
// Scripts run only if they carry this request's nonce, which Next adds to
// its own scripts, or if a script that does loads them ('strict-dynamic':
// Clerk, Stripe, Vercel analytics, Sentry Replay, PostHog). No
// 'unsafe-inline' and no 'unsafe-eval' in production, so an injected
// <script> or inline event handler doesn't run.
//
// A nonce needs every page rendered per request: a prerendered page's
// scripts would have no nonce and none of them would run. The root layout
// guarantees it (await connection(), checked by lib/csp.test.js).

const HOSTS = {
  clerk: ["https://clerk.helixon.co.uk", "https://*.clerk.accounts.dev", "https://*.clerk.com"],
  stripeJs: ["https://js.stripe.com"],
  posthogAssets: ["https://us-assets.i.posthog.com"],
  vercelScripts: ["https://va.vercel-scripts.com"],
  sentryCdn: ["https://browser.sentry-cdn.com"],
  turnstile: ["https://challenges.cloudflare.com"],
};

export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const scriptHosts = [
  ...HOSTS.clerk,
  ...HOSTS.turnstile,
  ...HOSTS.posthogAssets,
  ...HOSTS.vercelScripts,
  ...HOSTS.stripeJs,
  ...HOSTS.sentryCdn,
];

function common() {
  return [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://img.clerk.com https://us.i.posthog.com",
    "connect-src 'self' https://clerk.helixon.co.uk https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://*.clerk-telemetry.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com",
    "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev https://clerk.helixon.co.uk",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'self'",
    "report-uri /api/csp-report",
  ];
}

// React's development build needs eval for its debugging tools; production
// never does.
const devEval = (isDev) => (isDev ? " 'unsafe-eval'" : "");

export function buildCsp(nonce, { isDev = false } = {}) {
  // Host allowlist and https: are ignored by browsers that understand
  // 'strict-dynamic' and only kept as a fallback for very old ones.
  return [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval(isDev)} ${scriptHosts.join(" ")}`,
    ...common(),
  ].join("; ");
}
