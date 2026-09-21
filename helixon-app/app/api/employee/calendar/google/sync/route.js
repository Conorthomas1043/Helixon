import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { sync } from "@/lib/google-calendar";

export async function POST() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const result = await sync(employeeId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
