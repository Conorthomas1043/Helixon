import { NextResponse } from "next/server";
import { destroyAdminSession, isAdminRouteHidden } from "@/lib/admin-auth";

// POST only. The header "Log out" button used to navigate to this URL, which
// sends a GET, so the request was answered 405 and the session was never
// ended - admins stayed logged in for the full 8 hours. The button now POSTs
// (see app/admin/layout.js). Cross-site POSTs are already refused in proxy.ts,
// and forcing a logout is not a meaningful attack, so no CSRF token is needed.
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
