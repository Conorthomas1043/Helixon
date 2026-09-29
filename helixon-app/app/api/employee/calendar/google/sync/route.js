import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/session";
import { sync } from "@/lib/google-calendar";

export async function POST() {
  const { employeeId, forbidden } = await employeeAccess("calendar", "edit");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const result = await sync(employeeId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
