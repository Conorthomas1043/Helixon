// app/api/employee/calendar/feed-token/route.js
// Issues (or shows) the signed-in employee's secret ICS feed URL - see
// lib/employee-calendar.js's ensureFeedToken/regenerateFeedToken and the
// feed itself at app/api/employee/calendar/feed/[token].

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { ensureFeedToken, regenerateFeedToken } from "@/lib/employee-calendar";

function feedUrl(token) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  return `${origin}/api/employee/calendar/feed/${token}`;
}

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const token = await ensureFeedToken(employeeId);
  if (!token) return NextResponse.json({ ok: false, error: "Could not generate a feed link." }, { status: 500 });
  return NextResponse.json({ ok: true, url: feedUrl(token) });
}

export async function POST() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const token = await regenerateFeedToken(employeeId);
  if (!token) return NextResponse.json({ ok: false, error: "Could not regenerate the feed link." }, { status: 500 });
  return NextResponse.json({ ok: true, url: feedUrl(token) });
}
