// lib/session.js
// Reads the current employee session in server-side route handlers.
// Backed by lib/employee-auth.js (Supabase employee_sessions table) - this
// file exposes the narrower shapes the /api/employee/* routes want.

import { NextResponse } from "next/server";
import { getEmployeeSession } from "./employee-auth";
import { can } from "./employee-permissions";

export const SESSION_COOKIE = "employee_session";

export async function getCurrentEmployeeId() {
  const session = await getEmployeeSession();
  return session?.id || null;
}

/**
 * Session check plus a permission check for one portal section
 * (lib/employee-permissions.js). Use "view" for reads and "edit" for
 * anything that changes data:
 *
 *   const { employeeId, forbidden } = await employeeAccess("calendar", "edit");
 *   if (forbidden) return forbidden;
 *   if (!employeeId) return 401...
 *
 * Signed out: employeeId is null and forbidden is null (the route's own 401
 * applies). Signed in without access: `forbidden` is a ready 403 response -
 * not a 401, which the portal would treat as "signed out" and bounce the
 * employee to the login page.
 */
export async function employeeAccess(section, level = "view") {
  const employee = await getEmployeeSession();
  if (!employee) return { employeeId: null, employee: null, forbidden: null };
  if (section && !can(employee, section, level)) {
    const error =
      level === "edit" && can(employee, section, "view")
        ? "You have view-only access to this part of the portal."
        : "You don't have access to this part of the portal.";
    return {
      employeeId: null,
      employee,
      forbidden: NextResponse.json({ ok: false, error, code: "forbidden" }, { status: 403 }),
    };
  }
  return { employeeId: employee.id, employee, forbidden: null };
}
