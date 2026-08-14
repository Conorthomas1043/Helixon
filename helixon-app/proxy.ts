import { NextResponse, NextRequest } from "next/server";
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  if (shouldSkip) return NextResponse.next();

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
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Your IP has been blocked." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Gate /analyse behind the trial-signup cookie ───────────────────────
  if (pathname.startsWith("/analyse") && !request.cookies.get("helixon_trial")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 4. Continue — attach IP header for downstream API routes ─────────────
  const response = NextResponse.next();
  response.headers.set("x-client-ip", ip);
  return response;
}