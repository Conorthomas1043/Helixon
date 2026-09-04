import { NextResponse } from "next/server";
import { loginEmployee } from "@/lib/employee-auth";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

export async function POST(request) {
  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required." }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    // Same generic error a real wrong-credentials response would give -
    // doesn't confirm/deny anything about username format validity.
    return NextResponse.json({ ok: false, error: "Incorrect username or password. Please try again." }, { status: 401 });
  }

  const result = await loginEmployee({ username, password, ip: remoteIp });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 401 });
  }

  return NextResponse.json({ ok: true, employee: result.employee });
}
