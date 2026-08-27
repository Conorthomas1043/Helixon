import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getStats } from "@/lib/employee-store";

export async function GET() {
  const employeeId = getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, stats: getStats() });
}
