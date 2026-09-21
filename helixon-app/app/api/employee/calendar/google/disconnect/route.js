import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { disconnect } from "@/lib/google-calendar";

export async function POST() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const ok = await disconnect(employeeId);
  if (!ok) return NextResponse.json({ ok: false, error: "Could not disconnect." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
