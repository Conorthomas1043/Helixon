// app/api/employee/calendar/google/connect/route.js
// Starts the OAuth2 authorization-code flow (redirects to Google's
// consent screen). See lib/google-calendar.js for why this needs
// GOOGLE_CALENDAR_CLIENT_ID/SECRET before it can do anything.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getCurrentEmployeeId } from "@/lib/session";
import { isConfigured, getAuthUrl } from "@/lib/google-calendar";

// Short-lived, httpOnly - a CSRF guard for the callback (the state value
// returned by Google must match this), not a long-term session artefact.
const STATE_COOKIE = "google_oauth_state";

export async function GET(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.redirect(new URL("/employee/login", request.url));
  }
  if (!isConfigured()) {
    return NextResponse.redirect(new URL("/employee/calendar?googleError=not_configured", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(getAuthUrl(state));
}
