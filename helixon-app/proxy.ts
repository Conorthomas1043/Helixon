import { NextResponse, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { GATE_COOKIE_NAME, verifyGateCookie } from "@/lib/site-gate";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

// Flip to false to go live again - routes all page traffic to
// /under-development while true, leaving /api and static assets alone.
const DEV_MODE = true;

// Path admins are sent to when they hit /admin* without a valid session.
// NOTE: adjust this if your real admin login page lives somewhere else -
// this is the one place that needs to change.
const ADMIN_LOGIN_PATH = "/admin/login";

const SKIP_LOG = ["/api/internal/", "/_next/", "/favicon", "/robots"];

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

// IMPORTANT: this must be named `proxy` (or a default export) and live in
// proxy.ts - Next.js 16 renamed the middleware.ts/middleware() convention
// to proxy.ts/proxy(). Having both middleware.ts and proxy.ts in the repo
// at once is a build error ("Both middleware file... and proxy file...
// detected"), which is why the build was failing. middleware.ts had the
// up-to-date logic (session refresh, cookie copying) but the wrong
// file name/export for this Next.js version; proxy.ts had the correct
// file name but the older, buggy logic. This file merges them: correct
// name, correct export, current logic. Delete middleware.ts once this is
// in place - don't keep both.
//
// Auth: identity now comes from Clerk instead of Supabase Auth. The whole
// handler below runs *inside* clerkMiddleware() so that `auth()` (used
// here, and in server components/route handlers via `@clerk/nextjs/server`)
// has a request context to read from. Clerk manages its own session
// cookies internally - there's no more manual cookie-copying dance like
// the old Supabase refresh-token flow required.
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // ── 0. Maintenance gate - checked first, before anything else ────────────
  // Fix: previously this only checked whether the helixon_dev_unlocked
  // cookie was PRESENT. httpOnly stops JS from setting it, but it doesn't
  // stop a visitor from opening devtools → Application → Cookies and
  // typing the name/value in by hand - that's a plain text match with no
  // secret involved, so anyone could "unlock" the site without ever
  // knowing the password. The cookie now carries an HMAC signature
  // (lib/site-gate.ts) that only the server can produce, so a hand-typed
  // cookie fails verification and gets bounced back to the gate.
  if (
    DEV_MODE &&
    pathname !== "/under-development" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    !(await verifyGateCookie(request.cookies.get(GATE_COOKIE_NAME)?.value))
  ) {
    return NextResponse.redirect(new URL("/under-development", request.url));
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ua = request.headers.get("user-agent") || "";
  const method = request.method;

  // ── 1. Skip internal / static paths ───────────────────────────────────────
  const shouldSkip = SKIP_LOG.some((p) => pathname.startsWith(p));
  if (shouldSkip) {
    return NextResponse.next();
  }

  // ── 2. Check blocked IPs ────────────────────────────────────────────────
  let blocked = false;
  try {
    const logRes = await fetch(
      new URL("/api/internal/edge-log", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Shared secret so /api/internal/edge-log can tell this call came
          // from our own proxy and not an external POST forging traffic
          // data - see the comment at the top of that route.
          "x-internal-secret": process.env.INTERNAL_EDGE_LOG_SECRET || "",
        },
        body: JSON.stringify({
          ip, ua, method, path: pathname,
          ts: new Date().toISOString(),
          referer: request.headers.get("referer") || "",
          country: request.headers.get("x-vercel-ip-country") || "",
          city: request.headers.get("x-vercel-ip-city") || "",
          // Vercel enriches every request with these for free (no external
          // geolocation call, no rate limit) - see
          // https://vercel.com/docs/headers/request-headers
          lat: request.headers.get("x-vercel-ip-latitude") || "",
          lon: request.headers.get("x-vercel-ip-longitude") || "",
        }),
      }
    );
    if (logRes.ok) {
      const { isBlocked } = await logRes.json();
      blocked = !!isBlocked;
    }
  } catch {
    // fail open
  }

  if (blocked) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Your IP has been blocked." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Gate /analyse behind authentication ────────────────────────────────
  // Trial access has been removed - there is no more anonymous/cookie-based
  // path into /analyse. A signed-in session is required just to reach the
  // page at all. Whether that user is actually on an active paid plan is
  // checked deeper in (in /api/run, which does the real subscription-status
  // query) - middleware only answers "are they logged in", since doing a
  // second DB round-trip for subscription status on every request here
  // would be redundant with that check.
  if (pathname.startsWith("/analyse")) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── 3b. Gate /admin behind a valid admin session ──────────────────────────
  // Unaffected by the Clerk migration - admin auth is a deliberately
  // separate system (env-var credentials + its own signed session cookie),
  // never built on Supabase Auth or Clerk. This uses the same signed,
  // httpOnly helixon_admin_session cookie the API routes check (verified
  // here via lib/admin-session.js, an Edge-Runtime-safe reimplementation of
  // the same check lib/admin-auth.js uses server-side - see that file for
  // why it's not just imported directly). Excludes the login page itself so
  // this doesn't redirect-loop.
  if (pathname.startsWith("/admin") && pathname !== ADMIN_LOGIN_PATH) {
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const adminSession = await verifyAdminSessionToken(adminToken);

    if (!adminSession) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
  }

  // ── 4. Continue - attach IP header for downstream API routes ─────────────
  const response = NextResponse.next();
  response.headers.set("x-client-ip", ip);
  return response;
});
