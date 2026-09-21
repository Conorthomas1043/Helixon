// app/api/employee/calendar/google/callback/route.js
// Google redirects here with ?code=&state= after the employee approves
// (or denies) access. Exchanges the code for tokens and stores them
// (lib/google-calendar.js's saveConnection), then sends the employee
// back to the calendar page with a query flag the UI reads for a toast.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentEmployeeId } from "@/lib/session";
import { exchangeCodeForTokens, saveConnection } from "@/lib/google-calendar";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.redirect(new URL("/employee/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (googleError) {
    // The employee declined consent, or Google reported some other issue -
    // not an app bug, just relay it.
    return NextResponse.redirect(new URL(`/employee/calendar?googleError=${encodeURIComponent(googleError)}`, request.url));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/employee/calendar?googleError=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first consent (or with
      // prompt=consent, which getAuthUrl always sets) - if it's still
      // missing here, something upstream changed; ask them to revoke
      // Helixon's access in their Google Account and reconnect.
      return NextResponse.redirect(new URL("/employee/calendar?googleError=no_refresh_token", request.url));
    }
    await saveConnection(employeeId, tokens);
    return NextResponse.redirect(new URL("/employee/calendar?googleConnected=1", request.url));
  } catch (err) {
    console.error("[google-calendar] callback failed:", err.message);
    return NextResponse.redirect(new URL("/employee/calendar?googleError=exchange_failed", request.url));
  }
}
