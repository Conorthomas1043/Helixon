// lib/session.js
// Reads the employee session cookie in server-side route handlers.

import { cookies } from "next/headers";
import { getEmployeeIdForToken } from "./employee-store";

export const SESSION_COOKIE = "employee_session";

export async function getCurrentEmployeeId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getEmployeeIdForToken(token);
}
