// app/api/admin/employees/route.js
// Admin-only endpoint to manage employee accounts.
// GET  → list all employees
// POST → create employee  { action: "create", username, full_name, password, role }
// POST → delete employee  { action: "delete", id }
// POST → reset password   { action: "reset_password", id, password }

import { supabase } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-auth";
import crypto from "crypto";

function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || "helixon_salt";
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

async function authCheck(request) {
  const session = await getAdminSession();
  if (session) return session;
  const k = request.headers.get("x-admin-key");
  return k === process.env.ADMIN_KEY ? { username: "api-key" } : null;
}

export async function GET(request) {
  const session = await authCheck(request);
  if (!session) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, username, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true, employees: employees || [] });
}

export async function POST(request) {
  const session = await authCheck(request);
  if (!session) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action } = body;

    // ── Create ────────────────────────────────────────────────────────────────
    if (action === "create") {
      const { username, full_name, password, role = "employee" } = body;

      if (!username?.trim() || !full_name?.trim() || !password?.trim()) {
        return Response.json({ ok: false, error: "Username, full name, and password are required." }, { status: 400 });
      }
      if (!["employee", "manager"].includes(role)) {
        return Response.json({ ok: false, error: "Role must be employee or manager." }, { status: 400 });
      }
      if (password.length < 8) {
        return Response.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
      }

      const password_hash = hashPassword(password);

      const { data, error } = await supabase
        .from("employees")
        .insert({ username: username.trim(), full_name: full_name.trim(), password_hash, role })
        .select("id, username, full_name, role, created_at")
        .single();

      if (error) {
        const msg = error.message.includes("unique") ? "Username already taken." : error.message;
        return Response.json({ ok: false, error: msg }, { status: 400 });
      }

      return Response.json({ ok: true, employee: data });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { id } = body;
      if (!id) return Response.json({ ok: false, error: "Employee ID required." }, { status: 400 });

      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

      return Response.json({ ok: true });
    }

    // ── Reset password ────────────────────────────────────────────────────────
    if (action === "reset_password") {
      const { id, password } = body;
      if (!id || !password) return Response.json({ ok: false, error: "ID and new password required." }, { status: 400 });
      if (password.length < 8) return Response.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });

      const password_hash = hashPassword(password);
      const { error } = await supabase.from("employees").update({ password_hash }).eq("id", id);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}