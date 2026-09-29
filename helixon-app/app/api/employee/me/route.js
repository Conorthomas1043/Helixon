import { NextResponse } from "next/server";
import { getEmployeeSession } from "@/lib/employee-auth";
import { effectivePermissions } from "@/lib/employee-permissions";

// Returns the currently signed-in employee, or 401. Used by the portal to
// personalise the greeting, drive the one-time "Welcome back" banner, hide
// sections the employee has no access to, and show the banner when an
// admin is viewing the portal as someone else.
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
      lastLogin: employee.last_login || null,
      permissions: effectivePermissions(employee),
      impersonatedBy: employee.impersonatedBy || null,
      adminUsername: employee.admin_username || null,
    },
  });
}
