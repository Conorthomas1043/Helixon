import crypto from "crypto";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { hashEmployeePassword, startEmployeeSession } from "@/lib/employee-auth";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanUuid } from "@/lib/sanitize";

// Signs the admin into the staff portal (/employee) without a password.
//
//   POST {}                  -> the admin's own portal account, linked by
//                               employees.admin_username and created on
//                               first use (role super_admin, full access)
//   POST { employeeId }      -> "view as" that employee: a session marked
//                               impersonated_by, capped at an hour, and
//                               shown as such in the portal
//
// Both are audited. The admin's own account gets a random password nobody
// knows, so it can only be reached from here.

const MIGRATION_NEEDED = "Admin portal access needs the latest database migration (admin_controls).";

function portalUsernameFor(adminUsername) {
  const base = `admin.${String(adminUsername).toLowerCase().replace(/[^a-z0-9._-]/g, "")}`.slice(0, 56);
  return base.length >= 3 ? base : `admin.${crypto.randomBytes(3).toString("hex")}`;
}

async function ownPortalAccount(supabase, adminUsername) {
  const { data: linked, error } = await supabase
    .from("employees")
    .select("id,is_active")
    .eq("admin_username", adminUsername)
    .maybeSingle();
  if (error) return { error };
  if (linked) return { employee: linked, created: false };

  let username = portalUsernameFor(adminUsername);
  const { data: taken } = await supabase.from("employees").select("id").eq("username", username).maybeSingle();
  if (taken) username = `${username.slice(0, 57)}-${crypto.randomBytes(3).toString("hex")}`;

  const { data: employee, error: insertError } = await supabase
    .from("employees")
    .insert({
      username,
      password_hash: hashEmployeePassword(crypto.randomBytes(32).toString("hex")),
      full_name: adminUsername,
      display_name: adminUsername,
      role: "super_admin",
      is_active: true,
      admin_username: adminUsername,
    })
    .select("id,is_active")
    .single();
  if (insertError) return { error: insertError };
  return { employee, created: true };
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const supabase = getAdminSupabase();
    const body = await request.json().catch(() => ({}));

    if (body?.employeeId) {
      const employeeId = cleanUuid(body.employeeId);
      if (!employeeId) return json({ error: "A valid employeeId is required." }, 400);
      const { data: employee, error } = await supabase
        .from("employees")
        .select("id,username,is_active")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) return adminDbError("employees/portal", error);
      if (!employee) return json({ error: "Employee not found." }, 404);
      if (!employee.is_active) return json({ error: "That account is deactivated. Activate it first to view the portal as them." }, 409);

      try {
        await startEmployeeSession(employee.id, { impersonatedBy: admin.username });
      } catch (e) {
        if (String(e.message).includes("impersonated_by")) return json({ error: MIGRATION_NEEDED }, 409);
        throw e;
      }
      await writeAdminAudit({
        adminUsername: admin.username,
        action: "employee_view_as",
        targetType: "employee",
        targetId: employee.id,
        metadata: { username: employee.username },
        request,
      });
      return json({ ok: true, redirect: "/employee/dashboard" });
    }

    const { employee, created, error } = await ownPortalAccount(supabase, admin.username);
    if (error?.code === "42703") return json({ error: MIGRATION_NEEDED }, 409);
    if (error) return adminDbError("employees/portal", error);
    if (!employee.is_active) return json({ error: "Your portal account has been deactivated. Activate it on the Employees page first." }, 409);

    await startEmployeeSession(employee.id);
    await writeAdminAudit({
      adminUsername: admin.username,
      action: created ? "employee_portal_account_created" : "employee_portal_open",
      targetType: "employee",
      targetId: employee.id,
      metadata: {},
      request,
    });
    return json({ ok: true, redirect: "/employee/dashboard" });
  } catch (error) {
    return adminErrorResponse("employees/portal", error);
  }
}
