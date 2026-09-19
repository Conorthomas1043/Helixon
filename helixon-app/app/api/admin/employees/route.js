import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { hashEmployeePassword } from "@/lib/employee-auth";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanLine, cleanUuid } from "@/lib/sanitize";

function validUsername(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{3,64}$/.test(value);
}

// Employee accounts are created by an admin and can reach internal tooling,
// so hold them to the same bar as any other credential.
const MIN_PASSWORD_LENGTH = 12;

function validPassword(value) {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH && value.length <= 200;
}

const PASSWORD_ERROR = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

const ROLES = new Set([
  "super_admin",
  "admin",
  "sales",
  "support",
  "operations",
  "viewer",
  "employee",
]);

// Ends every login session an employee has. Called when their access changes
// (password reset, deactivation, role change) so an already-signed-in browser
// - or a stolen session token - can't keep using the old access.
async function revokeEmployeeSessions(supabase, employeeId) {
  const { error } = await supabase.from("employee_sessions").delete().eq("employee_id", employeeId);
  if (error) console.error("[admin/employees] Failed to revoke employee sessions:", error.message);
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const search = cleanLine(searchParams.get("search"), 64);

    let query = supabase
      .from("employees")
      .select("id,username,display_name,full_name,role,is_active,created_at,last_login")
      .order("created_at", { ascending: false });

    if (search) {
      // A plain ilike() with the user's text as its value - never built into a
      // PostgREST filter string with .or(), where a crafted search could smuggle
      // in extra filter syntax. LIKE wildcards in the text are escaped so
      // "50%" searches for a literal percent sign.
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      query = query.ilike("username", `%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) return adminDbError("employees", error);

    return json({
      admin: { username: admin.username },
      employees: data || [],
    });
  } catch (error) {
    return adminErrorResponse("employees", error);
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request." }, 400);
    }

    const username = cleanLine(body.username, 64);
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = cleanLine(body.fullName || body.displayName, 200);
    const role = cleanLine(body.role || "employee", 40);

    if (!validUsername(username)) {
      return json({ error: "Username must be 3-64 characters using letters, numbers, dot, underscore or hyphen." }, 400);
    }
    if (!validPassword(password)) {
      return json({ error: PASSWORD_ERROR }, 400);
    }
    if (!fullName || fullName.length > 160) {
      return json({ error: "Full name is required and must be 160 characters or fewer." }, 400);
    }
    if (!ROLES.has(role)) {
      return json({ error: "Invalid employee role." }, 400);
    }

    const { data: existing, error: lookupError } = await supabase
      .from("employees")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) return adminDbError("employees", lookupError);
    if (existing) return json({ error: "An employee with that username already exists." }, 409);

    const passwordHash = hashEmployeePassword(password);

    const { data: employee, error } = await supabase
      .from("employees")
      .insert({
        username,
        password_hash: passwordHash,
        display_name: fullName,
        full_name: fullName,
        role,
        is_active: true,
      })
      .select("id,username,display_name,full_name,role,is_active,created_at,last_login")
      .single();

    if (error) return adminDbError("employees", error);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "create_employee",
      targetType: "employee",
      targetId: employee.id,
      metadata: { username, role },
      request,
    });

    return json({ ok: true, employee }, 201);
  } catch (error) {
    return adminErrorResponse("employees", error);
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request." }, 400);
    }

    const employeeId = cleanUuid(body.employeeId);
    const action = cleanLine(body.action, 40);

    if (!employeeId) return json({ error: "A valid employeeId is required." }, 400);

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id,username,display_name,full_name,role,is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) return adminDbError("employees", employeeError);
    if (!employee) return json({ error: "Employee not found." }, 404);

    let update = {};
    let revokeSessions = false;

    if (action === "set_role") {
      const role = cleanLine(body.role, 40);
      if (!ROLES.has(role)) return json({ error: "Invalid employee role." }, 400);
      update.role = role;
      revokeSessions = true;
    } else if (action === "activate") {
      update.is_active = true;
    } else if (action === "deactivate") {
      update.is_active = false;
      revokeSessions = true;
    } else if (action === "reset_password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (!validPassword(password)) return json({ error: PASSWORD_ERROR }, 400);
      update.password_hash = hashEmployeePassword(password);
      revokeSessions = true;
    } else if (action === "update_name") {
      const fullName = cleanLine(body.fullName, 200);
      if (!fullName || fullName.length > 160) return json({ error: "A valid full name is required." }, 400);
      update.full_name = fullName;
      update.display_name = fullName;
    } else {
      return json({ error: "Unknown employee action." }, 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from("employees")
      .update(update)
      .eq("id", employeeId)
      .select("id,username,display_name,full_name,role,is_active,created_at,last_login")
      .single();

    if (updateError) return adminDbError("employees", updateError);

    if (revokeSessions) await revokeEmployeeSessions(supabase, employeeId);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: `employee_${action}`,
      targetType: "employee",
      targetId: employeeId,
      metadata: action === "reset_password" ? { credentialChanged: true } : { update },
      request,
    });

    return json({ ok: true, employee: updated });
  } catch (error) {
    return adminErrorResponse("employees", error);
  }
}
