import { withSentryConfig } from '@sentry/nextjs';
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

const nextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...corsHeaders] },
      { source: "/api/:path*", headers: apiHeaders },
      {
        source: "/:area(admin|employee|dashboard|account|billing|analyse|api)/:path*",
        headers: noIndexHeaders,
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
