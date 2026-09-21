import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { recordHeartbeat, setBusy, getTeamPresence } from "@/lib/employee-presence";

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, team: await getTeamPresence() });
}

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "heartbeat") {
    const ok = await recordHeartbeat(employeeId);
    if (!ok) return NextResponse.json({ ok: false, error: "Could not update presence." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "busy") {
    const ok = await setBusy(employeeId, !!body.busy);
    if (!ok) return NextResponse.json({ ok: false, error: "Could not update presence." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
