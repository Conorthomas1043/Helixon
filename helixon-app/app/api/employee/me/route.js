import { NextResponse } from "next/server";
import { getEmployeeSession } from "@/lib/employee-auth";

// Returns the currently signed-in employee, or 401. Used by the employee
// dashboard to personalize the greeting and drive the one-time
// "Welcome back" banner after login.
export async function GET() {
  const employee = await getEmployeeSession();
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    employee: {
      id: employee.id,
      username: employee.username,
      role: employee.role,
      fullName: employee.full_name || employee.display_name,
    },
  });
}
