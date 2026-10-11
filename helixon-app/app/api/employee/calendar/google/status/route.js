import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/employee/session";
import { isConfigured, getConnection } from "@/lib/interviews/google-calendar";

export async function GET() {
  const { employeeId, forbidden } = await employeeAccess("calendar", "view");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, configured: isConfigured(), connection: await getConnection(employeeId) });
}
