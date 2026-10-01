import { NextResponse, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isTextualBody, stripSecretHeaders } from "@/lib/request-capture";
import { GATE_COOKIE_NAME, verifyGateCookie } from "@/lib/site-gate";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

// Flip to false to go live again - routes all page traffic to
// /under-development while true, leaving /api and static assets alone.
// For a temporary closure use the "Maintenance mode" switch on
// /admin/site instead: no deploy, and admins can still use the site.
const DEV_MODE = false;

// Stay reachable while the admin's maintenance switch is on: the console,
// the staff portal, the maintenance page itself and the gate behind it.
const MAINTENANCE_EXEMPT_PREFIXES = ["/admin", "/employee", "/under-development", "/api", "/_next"];

// Path admins are sent to when they hit /admin* without a valid session.
// NOTE: adjust this if your real admin login page lives somewhere else -
// this is the one place that needs to change.
const ADMIN_LOGIN_PATH = "/admin/login";

const LOG_UID_HEADER = "x-helixon-log-uid";

const SKIP_LOG = ["/api/internal/", "/api/csp-report", "/_next/", "/favicon", "/robots", "/sitemap"];

// Pages that need a Clerk session just to load.
const SIGNED_IN_ONLY_PREFIXES = ["/analyse", "/dashboard", "/account", "/billing"];

// ── Hidden admin ────────────────────────────────────────────────────────────
// By default the admin login lives at the well-known /admin/login, and anyone
// poking /admin is redirected there, which confirms the admin area exists and
// where. Set ADMIN_LOGIN_SLUG (8+ letters, digits, - or _; e.g. "ops-4kx9p2q")
// and the default route disappears:
//   - the login page is served ONLY at /<slug>
//   - /admin/login, every other /admin page and every /api/admin endpoint
//     answer with an ordinary 404 unless the request carries a valid admin
//     session, so there's nothing to discover or probe
// Leave it unset and behaviour is unchanged (redirect to /admin/login).
const ADMIN_LOGIN_SLUG = (process.env.ADMIN_LOGIN_SLUG || "").replace(/^\/+|\/+$/g, "");
const HIDE_ADMIN = /^[A-Za-z0-9_-]{8,}$/.test(ADMIN_LOGIN_SLUG);

// Rewriting to a path that has no route makes Next render the site's normal
// 404 page with a 404 status.
function notFoundResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_not-found-hidden", request.url), { status: 404 });
}

// ── CSRF ────────────────────────────────────────────────────────────────────
// Every customer-facing API route authenticates with a cookie the browser
// attaches automatically (Clerk's session), so a malicious page could make a
// signed-in user's browser fire a POST/PATCH/DELETE at us. Browsers tell us
// where a request came from (the Origin header, or Sec-Fetch-Site) and
// scripts on other sites can't forge either - so any state-changing /api
// request that provably comes from another site is rejected here, once, for
// all routes. (The admin API additionally uses a double-submit token, see
// lib/admin-csrf.js.)
//
// Requests with neither header are non-browser clients (curl, server-to-
// server) - there's no ambient browser cookie to abuse, so they pass and are
// still subject to each route's own authentication.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Called by other servers (Stripe, Clerk) or by this proxy itself: they carry
// their own signature/secret and never have a browser Origin. /api/v1 is the
// agency REST API: it authenticates only by API key header, never by
// cookie, so there's no ambient credential for a cross-site request to
// ride on (and the LinkedIn extension calls it from its own origin).
const CSRF_EXEMPT_PREFIXES = ["/api/webhooks/", "/api/internal/", "/api/csp-report", "/api/v1/"];

function addHostWithVariants(hosts: Set<string>, host?: string | null) {
  if (!host) return;
  const h = host.toLowerCase();
  hosts.add(h);
  hosts.add(h.startsWith("www.") ? h.slice(4) : `www.${h}`); // apex <-> www
}

function isCrossSiteRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    if (origin === "null") return true; // sandboxed iframe / data: URL
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return true;
    }
    const allowed = new Set<string>();
    addHostWithVariants(allowed, request.nextUrl.host);
    addHostWithVariants(allowed, request.headers.get("host"));
    try {
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        addHostWithVariants(allowed, new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
      }
    } catch {
      /* malformed env var - ignore */
    }
    return !allowed.has(originHost);
  }

  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

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
export default clerkMiddleware(async (auth, request: NextRequest, event) => {
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

  // ── 0b. CSRF: refuse cross-site state-changing API requests ───────────────
  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p)) &&
    isCrossSiteRequest(request)
  ) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Cross-site request blocked." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
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

  // ── 2. Check blocked IPs (and the maintenance switch) ───────────────────
  let blocked = false;
  let maintenance = false;
  let capturePayload = false;
  let logged = false;
  // Ties this request's log line to anything reported about it later.
  const uid = crypto.randomUUID();
  // Requests this proxy may still redirect or 404 after logging - the log
  // line is written before the answer, so it can be updated.
  const mayFollowUp =
    SIGNED_IN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin/") ||
    (HIDE_ADMIN && pathname === `/${ADMIN_LOGIN_SLUG}`);
  // Background update to this request's log line (the request inspector
  // on Admin > Traffic shows it). Never delays the response.
  const report = (update: Record<string, unknown>) => {
    if (!logged) return;
    event.waitUntil(
      fetch(new URL("/api/internal/edge-log", request.url), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_EDGE_LOG_SECRET || "",
        },
        body: JSON.stringify({ uid, ...update }),
      }).catch(() => {})
    );
  };
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
          // Lets the firewall tell a request the visitor made themselves
          // from one another site made their browser send (an <img>, a
          // link) - see lib/security/firewall.js.
          fetchSite: request.headers.get("sec-fetch-site") || "",
          // For the request inspector. Cookies, tokens and other secrets
          // never leave this function (lib/request-capture.js); edge-log
          // redacts again before anything is stored.
          uid,
          mayFollowUp,
          query: request.nextUrl.search,
          host: request.headers.get("host") || "",
          protocol: request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", ""),
          headers: stripSecretHeaders(Object.fromEntries(request.headers.entries())),
          region: request.headers.get("x-vercel-ip-country-region") || "",
          postal: request.headers.get("x-vercel-ip-postal-code") || "",
          timezone: request.headers.get("x-vercel-ip-timezone") || "",
          edgeId: request.headers.get("x-vercel-id") || "",
        }),
      }
    );
    if (logRes.ok) {
      const { isBlocked, maintenance: underMaintenance, capturePayload: keepBody } = await logRes.json();
      blocked = !!isBlocked;
      maintenance = !!underMaintenance;
      capturePayload = !!keepBody;
      logged = true;
    }
  } catch {
    // fail open
  }

  if (blocked) {
    // Keep what a blocked request tried to send (text bodies only, small
    // ones, redacted by edge-log) - it's refused anyway, so reading it
    // costs nothing, and it shows what the attack was.
    const contentType = request.headers.get("content-type") || "";
    const length = Number(request.headers.get("content-length") || 0);
    if (capturePayload && MUTATING_METHODS.has(method) && isTextualBody(contentType) && length > 0 && length <= 65536) {
      try {
        report({ payload: (await request.text()).slice(0, 20000), contentType });
      } catch {
        // unreadable body - nothing to keep
      }
    }
    // API callers need a JSON error they can parse; browser page
    // navigations need an actual page - previously this returned raw JSON
    // for both, so a blocked visitor hitting any page saw unstyled JSON
    // text instead of a page. /rate-limited already exists for exactly
    // this (components/landing/TooManyRequestsPage) and just wasn't used
    // here.
    if (pathname.startsWith("/api")) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Your IP has been blocked." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return NextResponse.redirect(new URL("/rate-limited", request.url));
  }

  // ── 2b. Maintenance mode (admin switch) ──────────────────────────────────
  // Public pages go to /under-development. Visitors who know the gate
  // password (signed cookie) and signed-in admins carry on as normal.
  if (
    maintenance &&
    !MAINTENANCE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !(HIDE_ADMIN && pathname === `/${ADMIN_LOGIN_SLUG}`) &&
    !(await verifyGateCookie(request.cookies.get(GATE_COOKIE_NAME)?.value)) &&
    !(await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value))
  ) {
    report({ outcome: "redirected", statusCode: 307, location: "/under-development", rule: "maintenance" });
    return NextResponse.redirect(new URL("/under-development", request.url));
  }

  // ── 3. Gate /analyse behind authentication ────────────────────────────────
  // Trial access has been removed - there is no more anonymous/cookie-based
  // path into /analyse. A signed-in session is required just to reach the
  // page at all. Whether that user is actually on an active paid plan is
  // checked deeper in (in /api/run, which does the real subscription-status
  // query) - middleware only answers "are they logged in", since doing a
  // second DB round-trip for subscription status on every request here
  // would be redundant with that check.
  // /dashboard, /account and /billing are gated the same way: their pages
  // render a shell and only find out they're signed out when the data call
  // returns 401, which showed logged-out visitors a broken "Unable to load
  // dashboard" screen instead of the login page.
  if (SIGNED_IN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const { userId } = await auth();
    if (!userId) {
      // Carry the original destination through so <SignIn/>'s
      // fallbackRedirectUrl (app/login) is overridden by Clerk's own
      // redirect_url handling - previously this always sent a logged-in
      // user to /dashboard regardless of what they were trying to reach.
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect_url", pathname + request.nextUrl.search);
      report({ outcome: "redirected", statusCode: 307, location: "/login", rule: "sign_in" });
      return NextResponse.redirect(loginUrl);
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
  if (HIDE_ADMIN) {
    // The only public entrance is /<slug>, served by the real login page.
    if (pathname === `/${ADMIN_LOGIN_SLUG}`) {
      return NextResponse.rewrite(new URL(ADMIN_LOGIN_PATH, request.url));
    }
    // The default URL no longer exists.
    if (pathname === ADMIN_LOGIN_PATH) {
      report({ outcome: "not_found", statusCode: 404, rule: "admin" });
      return notFoundResponse(request);
    }
  }

  const isAdminPage = pathname.startsWith("/admin") && pathname !== ADMIN_LOGIN_PATH;
  // The login endpoint itself must stay reachable (it's rate-limited).
  const isAdminApi = pathname.startsWith("/api/admin/") && pathname !== "/api/admin/login";

  if (isAdminPage || isAdminApi) {
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const adminSession = await verifyAdminSessionToken(adminToken);

    if (!adminSession) {
      if (HIDE_ADMIN) {
        report({ outcome: "not_found", statusCode: 404, rule: "admin" });
        return notFoundResponse(request);
      }
      // Default behaviour: pages go to the login page; API routes do their own
      // 401 handling below (unchanged).
      if (isAdminPage) {
        report({ outcome: "redirected", statusCode: 307, location: ADMIN_LOGIN_PATH, rule: "admin" });
        return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
      }
    }
  }

  // ── 4. Continue - attach headers for downstream server components/routes ──
  // x-pathname lets a layout (e.g. app/admin/layout.js) know which page is
  // being rendered - Next doesn't otherwise expose the resolved pathname to
  // a layout, only to the page itself. It has to go on the *request*
  // headers (not the response) to be readable via headers() in a server
  // component/route handler - a response header would only reach the
  // browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  // Lets the not-found page and error reporting mark this request's log
  // line with a real 404 / 500 (lib/request-status.js). Only ever set
  // here - a value the client sent is dropped.
  requestHeaders.delete(LOG_UID_HEADER);
  if (logged) requestHeaders.set(LOG_UID_HEADER, uid);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-client-ip", ip);
  return response;
});
