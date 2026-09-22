// app/api/employee/cold-calls/route.js
// Cold call log for the sales team - see lib/employee-cold-calls.js for the
// visibility/edit model (everyone sees every call; only the caller who
// logged it can edit or delete it).

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getColdCalls, addColdCall, updateColdCall, deleteColdCall, getColdCallStats, OUTCOMES } from "@/lib/employee-cold-calls";

const VALID_OUTCOMES = new Set(OUTCOMES);

export async function GET(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const mine = searchParams.get("mine") === "1";
  const stats = searchParams.get("stats") === "1";

  const [calls, callStats] = await Promise.all([
    getColdCalls({ from, employeeId: mine ? employeeId : undefined }),
    stats ? getColdCallStats() : Promise.resolve(null),
  ]);

  return NextResponse.json({ ok: true, calls, stats: callStats, outcomes: OUTCOMES });
}

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "create") {
    if (body.outcome !== undefined && !VALID_OUTCOMES.has(body.outcome)) {
      return NextResponse.json({ ok: false, error: "Invalid outcome." }, { status: 400 });
    }
    const call = await addColdCall(employeeId, body);
    if (!call) return NextResponse.json({ ok: false, error: "Could not log the call." }, { status: 500 });
    return NextResponse.json({ ok: true, call });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.outcome !== undefined && !VALID_OUTCOMES.has(body.outcome)) {
      return NextResponse.json({ ok: false, error: "Invalid outcome." }, { status: 400 });
    }
    const call = await updateColdCall(employeeId, body.id, body);
    if (!call) return NextResponse.json({ ok: false, error: "Call not found or you're not the one who logged it." }, { status: 404 });
    return NextResponse.json({ ok: true, call });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteColdCall(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Call not found or you're not the one who logged it." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
