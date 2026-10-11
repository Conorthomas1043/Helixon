import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/employee/session";
import { recordHeartbeat, setBusy, getTeamPresence } from "@/lib/employee/presence";
import { fields, flag, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const PresenceInput = fields({ action: str(20), busy: flag });

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

  const parsedBody = await parseBody(request, PresenceInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
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
