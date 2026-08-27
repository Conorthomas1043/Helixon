// app/api/employee/logout/route.js
import { logoutEmployee } from "@/lib/employee-auth";

export async function POST() {
  await logoutEmployee();
  return Response.json({ ok: true });
}