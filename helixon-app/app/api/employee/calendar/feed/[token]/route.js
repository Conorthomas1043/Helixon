// app/api/employee/calendar/feed/[token]/route.js
// The actual ICS feed Google Calendar / Apple Calendar poll after an
// employee adds it via "subscribe by URL" (app/employee/calendar's
// "Connect" panel). Deliberately NOT behind the employee_session cookie -
// a calendar app can't send it - so this authenticates with the opaque
// per-employee token instead (lib/employee-calendar.js's
// findEmployeeByFeedToken). Not listed in proxy.ts's gated prefixes,
// same as every other /api/employee/* route.

import { NextResponse } from "next/server";
import { findEmployeeByFeedToken, getEvents, buildIcsFeed } from "@/lib/employee-calendar";

const PAST_DAYS = 90;
const FUTURE_DAYS = 365;

export async function GET(request, { params }) {
  const { token } = await params;

  const employee = await findEmployeeByFeedToken(token);
  if (!employee) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const events = await getEvents({ from, to });
  const ics = buildIcsFeed(events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="helixon-team.ics"',
      // Calendar apps poll this on their own schedule (Google: roughly
      // every 12-24h; Apple: configurable) - a short server-side cache is
      // just to absorb a burst of near-simultaneous polls, not to control
      // their refresh interval.
      "Cache-Control": "private, max-age=300",
    },
  });
}
