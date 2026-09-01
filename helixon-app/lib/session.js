// lib/session.js
// Reads the current employee session in server-side route handlers.
// Backed by lib/employee-auth.js (Supabase employee_sessions table) — this
// file just exposes the narrower "give me the employee id" shape that the
// stats/todos routes want, so they don't each need the full session object.

import { getEmployeeSession } from "./employee-auth";

export const SESSION_COOKIE = "employee_session";

export async function getCurrentEmployeeId() {
  const session = await getEmployeeSession();
  return session?.id || null;
}
