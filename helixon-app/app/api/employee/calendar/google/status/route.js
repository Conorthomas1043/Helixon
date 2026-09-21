import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { isConfigured, getConnection } from "@/lib/google-calendar";

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, configured: isConfigured(), connection: await getConnection(employeeId) });
}
