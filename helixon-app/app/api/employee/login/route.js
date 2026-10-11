import { NextResponse } from "next/server";
import { loginEmployee } from "@/lib/employee/auth";
import { isFeatureEnabled } from "@/lib/ops/site-settings";
import { fields, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const StaffLoginInput = fields({ username: str(200), password: str(400) });

const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

export async function POST(request) {
  if (!(await isFeatureEnabled("employee_portal"))) {
    return NextResponse.json({ ok: false, error: "The staff portal is closed for the moment. Check with an admin." }, { status: 503 });
  }
  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const parsed = await parseBody(request, StaffLoginInput, { respond: (status, error) => NextResponse.json({ ok: false, error }, { status }) });
  if (parsed.response) return parsed.response;
  const body = parsed.body;

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
