import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { hashEmployeePassword } from "@/lib/employee-auth";
import { writeAdminAudit } from "@/lib/admin-audit";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validUsername(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{3,64}$/.test(value.trim());
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}

const ROLES = new Set([
  "super_admin",
  "admin",
  "sales",
  "support",
  "operations",
  "viewer",
  "employee",
]);

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();

    let query = supabase
      .from("employees")
      .select("id,username,display_name,full_name,role,is_active,created_at,last_login")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `username.ilike.%${search.replace(/[,()]/g, "")}%`,
      );
    }

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    return json({
      admin: { username: admin.username },
      employees: data || [],
    });
  } catch (error) {
    return json(
      { error: error?.message || "Internal server error" },
      error?.message === "Unauthorized" ? 401 : 500,
    );
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();
    const body = await request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const fullName = String(body.fullName || body.displayName || "").trim();
    const role = String(body.role || "employee").trim();

    if (!validUsername(username)) {
      return json({ error: "Username must be 3-64 characters using letters, numbers, dot, underscore or hyphen." }, 400);
    }
    if (!validPassword(password)) {
      return json({ error: "Password must be at least 8 characters." }, 400);
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

    if (lookupError) return json({ error: lookupError.message }, 500);
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

    if (error) return json({ error: error.message }, 500);

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
    return json(
      { error: error?.message || "Internal server error" },
      error?.message === "Unauthorized" ? 401 : 500,
    );
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const action = String(body.action || "").trim();

    if (!employeeId) return json({ error: "employeeId is required." }, 400);

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id,username,display_name,full_name,role,is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) return json({ error: employeeError.message }, 500);
    if (!employee) return json({ error: "Employee not found." }, 404);

    let update = {};

    if (action === "set_role") {
      const role = String(body.role || "").trim();
      if (!ROLES.has(role)) return json({ error: "Invalid employee role." }, 400);
      update.role = role;
    } else if (action === "activate") {
      update.is_active = true;
    } else if (action === "deactivate") {
      update.is_active = false;
    } else if (action === "reset_password") {
      const password = String(body.password || "");
      if (!validPassword(password)) return json({ error: "Password must be at least 8 characters." }, 400);
      update.password_hash = hashEmployeePassword(password);
    } else if (action === "update_name") {
      const fullName = String(body.fullName || "").trim();
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

    if (updateError) return json({ error: updateError.message }, 500);

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
    return json(
      { error: error?.message || "Internal server error" },
      error?.message === "Unauthorized" ? 401 : 500,
    );
  }
}
