import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanUuid } from "@/lib/sanitize";
import { effectivePermissions, rolePreset } from "@/lib/employee/permissions";
import { ONBOARDING_TASKS } from "@/lib/onboarding-tasks";

// Everything the admin console's employee drawer shows about one person:
// the account, what they can do (role preset, overrides, effective), where
// they're signed in, their recent sign-in attempts, onboarding progress
// and what admins have changed on the account. Read-only - changes go
// through PATCH /api/admin/employees.

const COLUMNS = "id,username,display_name,full_name,email,role,is_active,created_at,updated_at,last_login,presence_status,presence_updated_at,permissions,admin_username";

export async function GET(request, { params }) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { id } = await params;
    const employeeId = cleanUuid(id);
    if (!employeeId) return json({ error: "A valid employee id is required." }, 400);

    const { data: employee, error } = await supabase.from("employees").select(COLUMNS).eq("id", employeeId).maybeSingle();
    if (error) return adminDbError("employees", error);
    if (!employee) return json({ error: "Employee not found." }, 404);

    const now = new Date().toISOString();
    const [sessions, attempts, onboarding, audit] = await Promise.all([
      supabase
        .from("employee_sessions")
        .select("id,created_at,expires_at,impersonated_by")
        .eq("employee_id", employeeId)
        .gt("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("login_attempts")
        .select("id,ts,ip,success")
        .eq("login_type", "employee")
        .eq("username", employee.username)
        .order("ts", { ascending: false })
        .limit(15),
      supabase.from("employee_onboarding_progress").select("task_key,completed_at").eq("employee_id", employeeId),
      supabase
        .from("admin_audit_logs")
        .select("id,admin_username,action,metadata,created_at")
        .eq("target_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const done = new Map((onboarding.data || []).map((r) => [r.task_key, r.completed_at]));

    return json({
      ok: true,
      employee,
      access: {
        role: rolePreset(employee.role),
        overrides: employee.permissions || null,
        effective: effectivePermissions(employee),
      },
      sessions: sessions.data || [],
      loginAttempts: attempts.data || [],
      onboarding: onboarding.error
        ? null
        : ONBOARDING_TASKS.map((t) => ({ key: t.key, label: t.label, completedAt: done.get(t.key) || null })),
      history: audit.data || [],
    });
  } catch (error) {
    return adminErrorResponse("employees", error);
  }
}
