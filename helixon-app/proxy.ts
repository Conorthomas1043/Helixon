import { NextResponse, NextRequest } from "next/server";

const SKIP_LOG = ["/api/internal/", "/_next/", "/favicon", "/robots"];

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
          // Fix — request.geo was removed from the Edge Runtime API;
          // geolocation now comes through Vercel-injected headers instead.
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
  // Fix — was checking "/analyze" (US spelling); the actual route in this
  // app is "/analyse" (see redirects in trial/verify/route.js and
  // TrialGateModal's default fallback). The old spelling meant this gate
  // never actually matched the real route.
  if (pathname.startsWith("/analyse") && !request.cookies.get("helixon_trial")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 4. Continue — attach IP header for downstream API routes ─────────────
  const response = NextResponse.next();
  response.headers.set("x-client-ip", ip);
  return response;
}