import { NextResponse } from "next/server";
import { logoutEmployee } from "@/lib/employee-auth";

export async function POST() {
  await logoutEmployee();
  return NextResponse.json({ ok: true });
}
