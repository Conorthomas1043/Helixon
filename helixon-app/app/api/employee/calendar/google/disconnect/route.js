import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/employee/session";
import { disconnect } from "@/lib/interviews/google-calendar";

export async function POST() {
  const { employeeId, forbidden } = await employeeAccess("calendar", "edit");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const ok = await disconnect(employeeId);
  if (!ok) return NextResponse.json({ ok: false, error: "Could not disconnect." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
