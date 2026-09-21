// app/api/employee/password/route.js
// Self-service password change for a signed-in employee.
//
// This didn't exist before: the only way to change an employee's password
// was an admin doing it for them from app/admin/employees (the "Reset
// password" button), which shows the plaintext new password once in an
// admin-only modal - useless to the employee themselves, and the first
// onboarding checklist item (lib/onboarding-tasks.js, "Set your password
// and confirm you can log in") had nothing in the product to actually do
// that with. This is what makes that checklist item literally true.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getCurrentEmployeeId, SESSION_COOKIE } from "@/lib/session";
import { hashEmployeePassword } from "@/lib/employee-auth";
import { supabase } from "@/lib/supabase";

// Same floor app/api/admin/employees/route.js enforces for employee
// accounts - one password policy, not two.
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return NextResponse.json({ ok: false, error: "Your current password is required." }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { ok: false, error: "New password must be different from your current password." },
      { status: 400 },
    );
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, password_hash")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !employee) {
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const currentOk = employee.password_hash && bcrypt.compareSync(currentPassword, employee.password_hash);
  if (!currentOk) {
    return NextResponse.json({ ok: false, error: "Your current password is incorrect." }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .from("employees")
    .update({ password_hash: hashEmployeePassword(newPassword) })
    .eq("id", employeeId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: "Could not update your password. Please try again." }, { status: 500 });
  }

  // Ends every session on every device, this one included - the same
  // "credential changed -> sign in again" behaviour an admin-initiated
  // reset already has (app/api/admin/employees PATCH's reset_password
  // action). The browser that just made this request signs in again with
  // the new password to confirm it actually works, rather than trusting
  // an unverified session left open under the old one.
  await supabase.from("employee_sessions").delete().eq("employee_id", employeeId);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
