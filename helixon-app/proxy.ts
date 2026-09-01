import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GATE_COOKIE_NAME, verifyGateCookie } from "@/lib/site-gate";

// Flip to false to go live again — routes all page traffic to
// /under-development while true, leaving /api and static assets alone.
const DEV_MODE = true;

const SKIP_LOG = ["/api/internal/", "/_next/", "/favicon", "/robots"];

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

// Copies cookies that Supabase's setAll gave us (name, value, AND its own
// options — maxAge/expires/domain/sameSite) onto whichever response we end
// up returning. Same principle as applyCookies() in the login route: if we
// return a *different* NextResponse (a redirect, a 403, etc.) without doing
// this, the refreshed session cookies never reach the browser and the user
// gets silently logged out the next time their access token expires.
function copyCookies(target, pendingCookies) {
  pendingCookies.forEach(({ name, value, options }) => {
    target.cookies.set(name, value, options);
  });
  return target;
}

// IMPORTANT: this must be named `proxy` (or a default export) and live in
// proxy.ts — Next.js 16 renamed the middleware.ts/middleware() convention
// to proxy.ts/proxy(). Having both middleware.ts and proxy.ts in the repo
// at once is a build error ("Both middleware file... and proxy file...
// detected"), which is why the build was failing. middleware.ts had the
// up-to-date logic (Supabase session refresh, cookie copying) but the
// wrong file name/export for this Next.js version; proxy.ts had the
// correct file name but the older, buggy logic. This file merges them:
// correct name, correct export, current logic. Delete middleware.ts once
// this is in place — don't keep both.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Supabase session refresh — must happen first, before any other logic
  // or return path, and nothing should run between createServerClient and
  // supabase.auth.getUser() below. This is what keeps a logged-in user's
  // session alive: it silently exchanges an expired access token for a new
  // one using the refresh token cookie, on every request that hits this
  // middleware. Note we deliberately call getUser() (which re-validates
  // against Supabase's server) rather than getSession() (which just reads
  // the JWT out of the cookie and can't be trusted in middleware).
  let pendingCookies: { name: string; value: string; options: any }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet;
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  // ── 0. Maintenance gate — checked first, before anything else ────────────
  // Fix: previously this only checked whether the helixon_dev_unlocked
  // cookie was PRESENT. httpOnly stops JS from setting it, but it doesn't
  // stop a visitor from opening devtools → Application → Cookies and
  // typing the name/value in by hand — that's a plain text match with no
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
    return copyCookies(
      NextResponse.redirect(new URL("/under-development", request.url)),
      pendingCookies
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
    return copyCookies(NextResponse.next({ request }), pendingCookies);
  }

  // ── 2. Check blocked IPs ────────────────────────────────────────────────
  let blocked = false;
  try {
    const logRes = await fetch(
      new URL("/api/internal/edge-log", request.url),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip, ua, method, path: pathname,
          ts: new Date().toISOString(),
          referer: request.headers.get("referer") || "",
          country: request.headers.get("x-vercel-ip-country") || "",
          city: request.headers.get("x-vercel-ip-city") || "",
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
    return copyCookies(
      new NextResponse(
        JSON.stringify({ ok: false, error: "Your IP has been blocked." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
      pendingCookies
    );
  }

  // ── 3. Gate /analyse behind the trial-signup cookie ───────────────────────
  if (pathname.startsWith("/analyse") && !request.cookies.get("helixon_trial")) {
    return copyCookies(NextResponse.redirect(new URL("/", request.url)), pendingCookies);
  }

  // ── 4. Continue — attach IP header for downstream API routes ─────────────
  const response = copyCookies(NextResponse.next({ request }), pendingCookies);
  response.headers.set("x-client-ip", ip);
  return response;
}