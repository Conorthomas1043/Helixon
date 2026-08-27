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

  // Determine whether the request actually arrived over HTTPS, rather than
  // trusting NODE_ENV alone — a production build served over plain http://
  // (e.g. local `next start` on localhost) would otherwise silently drop
  // a cookie marked Secure, breaking the session with no visible error.
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
