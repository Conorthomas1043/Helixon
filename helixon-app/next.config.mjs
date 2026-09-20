import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from '@sentry/nextjs';

// This app lives in a subfolder (helixon-app) of a larger repo, and there is a
// second package-lock.json in the parent folder. Next.js then guesses the parent
// as the project root, so Turbopack watches and scans the whole parent tree (slow
// to compile, sometimes never finishing in `next dev`) and prints a "workspace
// root may not be correct" warning. Pinning it to this folder fixes both.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=()" },
];

// CORS: nothing on this site is meant to be read by other websites, so the
// only origin ever allowed is our own. Vercel adds `Access-Control-Allow-
// Origin: *` to prerendered pages by default, which lets any site read them
// from a browser; naming our origin here replaces that. API routes never send
// CORS headers of their own, so cross-origin browser calls to them are
// refused, and Cross-Origin-Resource-Policy keeps other sites from embedding
// their responses.
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");

const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: SITE_ORIGIN },
  { key: "Vary", value: "Origin" },
];

const apiHeaders = [
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// Private areas: keep them out of search results without listing them in
// robots.txt (which would advertise where they are).
const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

// Content-Security-Policy, enforced. The sources are the third parties the
// app actually loads: Clerk (auth), Stripe, PostHog, Mapbox, Sentry, Vercel
// analytics and Google Fonts. 'unsafe-inline'/'unsafe-eval' are needed for
// Next.js today; replacing them with nonces is the stronger follow-up.
//
// This ran in Report-Only for a while first (violations went to
// /api/csp-report -> Vercel logs, never stored anywhere queryable). Flipped
// to enforced: every source here maps to a real, installed dependency, and
// both 'unsafe-inline' directives are already permissive enough to cover
// Next.js's own inline requirements. Not validated against live browser
// traffic from this environment - watch the browser console and Vercel
// logs after the next deploy for any surprise blocked-uri, and loosen the
// specific directive if something legitimate breaks.
const cspPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.helixon.co.uk https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://us-assets.i.posthog.com https://va.vercel-scripts.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://img.clerk.com https://*.mapbox.com https://us.i.posthog.com",
  "connect-src 'self' https://clerk.helixon.co.uk https://*.clerk.accounts.dev https://*.clerk.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.mapbox.com https://events.mapbox.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com",
  "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev https://clerk.helixon.co.uk",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig = {
  turbopack: { root: appRoot },
  async redirects() {
    return [
      // The cookie policy lived at /CookiePolicy (the only mixed-case URL on the
      // site) and its own footer linked to a /cookies that never existed.
      { source: "/CookiePolicy", destination: "/cookie-policy", permanent: true },
      { source: "/cookies", destination: "/cookie-policy", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          ...corsHeaders,
          { key: "Content-Security-Policy", value: cspPolicy },
        ],
      },
      { source: "/api/:path*", headers: apiHeaders },
      {
        source: "/:area(admin|employee|dashboard|account|billing|analyse|api)/:path*",
        headers: noIndexHeaders,
      },
      // The admin and employee consoles must never be stored by a shared
      // cache, a proxy or the browser's back/forward cache.
      {
        source: "/:area(admin|employee)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "helixon",

  project: "helixon",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
