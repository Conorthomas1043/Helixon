import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/session";
import { getStats } from "@/lib/employee-store";

export async function GET() {
  const { employeeId, forbidden } = await employeeAccess("platform", "view");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, stats: await getStats() });
}


