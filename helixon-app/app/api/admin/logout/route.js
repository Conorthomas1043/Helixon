import { NextResponse } from "next/server";
import { destroyAdminSession, isAdminRouteHidden } from "@/lib/admin/auth";

// POST only: a plain link here would send a GET, get a 405 and leave the
// session running, so the sign-out button POSTs (app/admin/_shared/session.js).
// Cross-site POSTs are already refused in proxy.ts, and forcing a logout is
// not a meaningful attack, so no CSRF token is needed.
export async function POST() {
  await destroyAdminSession();

  return NextResponse.json(
    {
      ok: true,
      // With the hidden-admin setup the login URL is a secret, so don't send
      // people back to a guessable path.
      redirectTo: isAdminRouteHidden() ? "/" : "/admin/login",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
