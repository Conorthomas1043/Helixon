import { NextResponse } from "next/server";
import { findEmployeeByEmail, createSession } from "@/lib/employee-store";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;

  const employee = email ? findEmployeeByEmail(email) : null;
  if (!employee || employee.password !== password) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const token = createSession(employee.id);

  const res = NextResponse.json({
    ok: true,
    employee: { id: employee.id, name: employee.name, email: employee.email },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
