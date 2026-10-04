import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { generateEmployeePassword, hashEmployeePassword } from "@/lib/employee-auth";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanEmail, cleanLine, cleanUuid } from "@/lib/sanitize";
import { ROLES as ROLE_LIST, cleanOverrides, effectivePermissions, overridesAfterRoleChange, overridesFor } from "@/lib/employee-permissions";
import { reportError } from "@/lib/report-error";

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

const ROLES = new Set(ROLE_LIST.map((r) => r.key));

// permissions/admin_username arrive with migration 20260929020000; until it
// is applied the list still loads, just without them.
const COLUMNS = "id,username,display_name,full_name,email,role,is_active,created_at,last_login,presence_status,presence_updated_at,permissions,admin_username";
const LEGACY_COLUMNS = "id,username,display_name,full_name,email,role,is_active,created_at,last_login,presence_status,presence_updated_at";

function withAccess(employee) {
  return employee ? { ...employee, effective_permissions: effectivePermissions(employee) } : employee;
}

async function selectEmployees(build) {
  let result = await build(COLUMNS);
  if (result.error?.code === "42703") result = await build(LEGACY_COLUMNS);
  return result;
}

// Ends login sessions for an employee: all of them, or just one. Called
// when their access changes (password reset, deactivation, role or
// permission change) so an already-signed-in browser - or a stolen session
// token - can't keep using the old access.
async function revokeEmployeeSessions(supabase, employeeId, sessionId = null) {
  let query = supabase.from("employee_sessions").delete().eq("employee_id", employeeId);
  if (sessionId) query = query.eq("id", sessionId);
  const { error } = await query;
  if (error) reportError("[admin/employees] Failed to revoke employee sessions:", error.message);
  return !error;
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const search = cleanLine(searchParams.get("search"), 64);

    const { data, error } = await selectEmployees((columns) => {
      let query = supabase.from("employees").select(columns).order("created_at", { ascending: false });
      if (search) {
        // A plain ilike() with the user's text as its value - never built into a
        // PostgREST filter string with .or(), where a crafted search could smuggle
        // in extra filter syntax. LIKE wildcards in the text are escaped so
        // "50%" searches for a literal percent sign.
        const escaped = search.replace(/[\\%_]/g, "\\$&");
        query = query.ilike("username", `%${escaped}%`);
      }
      return query;
    });
    if (error) return adminDbError("employees", error);

    // Live sessions per employee, for the "signed in" column.
    const { data: sessions } = await supabase
      .from("employee_sessions")
      .select("employee_id")
      .gt("expires_at", new Date().toISOString());
    const live = new Map();
    for (const s of sessions || []) live.set(s.employee_id, (live.get(s.employee_id) || 0) + 1);

    return json({
      admin: { username: admin.username },
      employees: (data || []).map((e) => ({ ...withAccess(e), active_sessions: live.get(e.id) || 0 })),
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
    // "generatePassword": the server picks a strong one and returns it once.
    const generated = body.generatePassword ? generateEmployeePassword() : null;
    const password = generated || (typeof body.password === "string" ? body.password : "");
    const fullName = cleanLine(body.fullName || body.displayName, 200);
    const role = cleanLine(body.role || "employee", 40);
    const email = body.email ? cleanEmail(body.email) : null;
    const permissions = body.permissions ? overridesFor(role, body.permissions) : null;

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
    if (body.email && !email) {
      return json({ error: "That email address doesn't look right." }, 400);
    }

    const { data: existing, error: lookupError } = await supabase
      .from("employees")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) return adminDbError("employees", lookupError);
    if (existing) return json({ error: "An employee with that username already exists." }, 409);

    const row = {
      username,
      password_hash: hashEmployeePassword(password),
      display_name: fullName,
      full_name: fullName,
      email,
      role,
      is_active: true,
    };
    if (permissions) row.permissions = permissions;

    const { data: employee, error } = await selectEmployees((columns) =>
      supabase.from("employees").insert(row).select(columns).single(),
    );

    if (error) return adminDbError("employees", error);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "create_employee",
      targetType: "employee",
      targetId: employee.id,
      metadata: { username, role, permissions, generatedPassword: Boolean(generated) },
      request,
    });

    return json({ ok: true, employee: withAccess(employee), temporaryPassword: generated }, 201);
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

    const { data: employee, error: employeeError } = await selectEmployees((columns) =>
      supabase.from("employees").select(columns).eq("id", employeeId).maybeSingle(),
    );

    if (employeeError) return adminDbError("employees", employeeError);
    if (!employee) return json({ error: "Employee not found." }, 404);

    let update = {};
    let revokeSessions = false;
    let auditMetadata = null;
    let temporaryPassword = null;

    if (action === "set_role") {
      const role = cleanLine(body.role, 40);
      if (!ROLES.has(role)) return json({ error: "Invalid employee role." }, 400);
      update.role = role;
      // Sections the admin customised keep their level; everything else
      // follows the new role (or all of it does, with resetPermissions).
      // Re-derived so a custom level that happens to match the new role's
      // default isn't stored as a pointless override.
      if ("permissions" in employee) {
        update.permissions = body.resetPermissions ? null : overridesAfterRoleChange(employee.permissions, role);
      }
      revokeSessions = true;
      auditMetadata = { from: employee.role, to: role, resetPermissions: Boolean(body.resetPermissions) };
    } else if (action === "set_permissions") {
      if (!("permissions" in employee)) {
        return json({ error: "Permissions need the latest database migration (admin_controls)." }, 409);
      }
      const desired = cleanOverrides(body.permissions) || {};
      update.permissions = overridesFor(employee.role, { ...effectivePermissions(employee), ...desired });
      auditMetadata = { before: effectivePermissions(employee), after: effectivePermissions({ ...employee, ...update }) };
    } else if (action === "reset_permissions") {
      if (!("permissions" in employee)) {
        return json({ error: "Permissions need the latest database migration (admin_controls)." }, 409);
      }
      update.permissions = null;
      auditMetadata = { before: cleanOverrides(employee.permissions) };
    } else if (action === "activate") {
      update.is_active = true;
    } else if (action === "deactivate") {
      update.is_active = false;
      revokeSessions = true;
    } else if (action === "reset_password") {
      temporaryPassword = body.generate ? generateEmployeePassword() : null;
      const password = temporaryPassword || (typeof body.password === "string" ? body.password : "");
      if (!validPassword(password)) return json({ error: PASSWORD_ERROR }, 400);
      update.password_hash = hashEmployeePassword(password);
      revokeSessions = true;
      auditMetadata = { credentialChanged: true, generated: Boolean(temporaryPassword) };
    } else if (action === "update_name" || action === "update_profile") {
      const fullName = cleanLine(body.fullName, 200);
      if (!fullName || fullName.length > 160) return json({ error: "A valid full name is required." }, 400);
      update.full_name = fullName;
      update.display_name = fullName;
      if (action === "update_profile") {
        const email = body.email ? cleanEmail(body.email) : null;
        if (body.email && !email) return json({ error: "That email address doesn't look right." }, 400);
        update.email = email;
      }
    } else if (action === "revoke_sessions" || action === "revoke_session") {
      const sessionId = action === "revoke_session" ? cleanUuid(body.sessionId) : null;
      if (action === "revoke_session" && !sessionId) return json({ error: "A valid sessionId is required." }, 400);
      const ok = await revokeEmployeeSessions(supabase, employeeId, sessionId);
      if (!ok) return json({ error: "Could not sign those sessions out. Please try again." }, 500);
      await writeAdminAudit({
        adminUsername: admin.username,
        action: `employee_${action}`,
        targetType: "employee",
        targetId: employeeId,
        metadata: { username: employee.username, sessionId },
        request,
      });
      return json({ ok: true, employee: withAccess(employee) });
    } else {
      return json({ error: "Unknown employee action." }, 400);
    }

    const { data: updated, error: updateError } = await selectEmployees((columns) =>
      supabase.from("employees").update(update).eq("id", employeeId).select(columns).single(),
    );

    if (updateError) return adminDbError("employees", updateError);

    if (revokeSessions) await revokeEmployeeSessions(supabase, employeeId);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: `employee_${action}`,
      targetType: "employee",
      targetId: employeeId,
      metadata: { username: employee.username, ...(auditMetadata || { update }) },
      request,
    });

    return json({ ok: true, employee: withAccess(updated), temporaryPassword });
  } catch (error) {
    return adminErrorResponse("employees", error);
  }
}
