// lib/employee-auth.js
// Real, persistent employee auth backed by Supabase - mirrors lib/admin-auth.js
// in spirit (hashed credentials, signed/short-lived session, timing-safe
// checks) but sessions live in the `employee_sessions` table since that's
// the schema already provisioned for this feature.
//
// Tables used (see your schema):
//   employees(id, username, password_hash, display_name, full_name, role,
//             is_active, created_at, last_login)
//   employee_sessions(id, employee_id, token, created_at, expires_at)
//   login_attempts(id, ts, ip, username, login_type, success)
//     - shared with admin login via the `login_type` column; employee
//       attempts are recorded here with login_type = 'employee'.
//
// Passwords are bcrypt-hashed (bcryptjs is already a project dependency).
// NOTE: if any `employees` rows were seeded with the old sha256+salt scheme
// from an earlier version of this file, their password_hash values won't
// verify against bcrypt.compare and those accounts will need to be
// re-issued a password via hashEmployeePassword() below.

import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "employee_session";
const SESSION_HOURS = 12;
const LOGIN_TYPE = "employee";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_USERNAME = 5;
const MAX_FAILURES_PER_IP = 20;

const GENERIC_LOGIN_ERROR = "Incorrect username or password. Please try again.";

// ── Password hashing ─────────────────────────────────────────────────────
export function hashEmployeePassword(password) {
  return bcrypt.hashSync(password, 12);
}

function verifyEmployeePassword(employee, password) {
  if (!employee || typeof password !== "string" || !password) return false;
  return bcrypt.compareSync(password, employee.password_hash);
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ── Rate limiting (shared login_attempts table, login_type = 'employee') ──
export async function checkEmployeeRateLimit(username, ip) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const [{ count: userFailures }, { count: ipFailures }] = await Promise.all([
      supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("login_type", LOGIN_TYPE)
        .eq("username", username)
        .eq("success", false)
        .gte("ts", since),
      ip
        ? supabase
            .from("login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("login_type", LOGIN_TYPE)
            .eq("ip", ip)
            .eq("success", false)
            .gte("ts", since)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((userFailures || 0) >= MAX_FAILURES_PER_USERNAME) {
      return { blocked: true, reason: "Too many failed attempts. Please try again in a few minutes." };
    }
    if ((ipFailures || 0) >= MAX_FAILURES_PER_IP) {
      return { blocked: true, reason: "Too many failed attempts from this network. Please try again shortly." };
    }
    return { blocked: false };
  } catch (e) {
    console.error("[employee-auth] Rate limit check failed (failing open):", e.message);
    return { blocked: false };
  }
}

async function recordAttempt(username, ip, success) {
  try {
    await supabase.from("login_attempts").insert({ username, ip, login_type: LOGIN_TYPE, success });
  } catch (e) {
    console.error("[employee-auth] Failed to record login attempt:", e.message);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────
// Always returns a generic error message on any failure path - unknown
// username, wrong password, or a deactivated account - so this endpoint
// can't be used to enumerate valid employee usernames or account status.
export async function loginEmployee({ username, password, ip }) {
  const rateLimit = await checkEmployeeRateLimit(username, ip);
  if (rateLimit.blocked) {
    return { ok: false, error: rateLimit.reason, status: 429 };
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, username, role, full_name, display_name, password_hash, is_active")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("[employee-auth] Lookup failed:", error.message);
    await recordAttempt(username, ip, false);
    return { ok: false, error: "Something went wrong. Please try again.", status: 500 };
  }

  const passwordOk = verifyEmployeePassword(employee, password);

  if (!employee || !passwordOk || !employee.is_active) {
    await recordAttempt(username, ip, false);
    return { ok: false, error: GENERIC_LOGIN_ERROR, status: 401 };
  }

  await recordAttempt(username, ip, true);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  const { error: sessionError } = await supabase.from("employee_sessions").insert({
    employee_id: employee.id,
    token,
    expires_at: expiresAt,
  });

  if (sessionError) {
    console.error("[employee-auth] Failed to create session:", sessionError.message);
    return { ok: false, error: "Something went wrong. Please try again.", status: 500 };
  }

  // Best-effort - a failed timestamp update shouldn't block a successful login.
  supabase.from("employees").update({ last_login: new Date().toISOString() }).eq("id", employee.id)
    .then(({ error: e }) => { if (e) console.error("[employee-auth] last_login update failed:", e.message); });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return {
    ok: true,
    employee: {
      id: employee.id,
      username: employee.username,
      role: employee.role,
      fullName: employee.full_name || employee.display_name,
    },
  };
}

// ── Get current session ──────────────────────────────────────────────────
// Re-checks is_active on every call (not just at login), so deactivating an
// employee immediately invalidates any session they're still holding.
export async function getEmployeeSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { data: session } = await supabase
      .from("employee_sessions")
      .select("employee_id, expires_at, employees(id, username, role, full_name, display_name, is_active)")
      .eq("token", token)
      .maybeSingle();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;
    if (!session.employees || session.employees.is_active === false) return null;

    return session.employees;
  } catch {
    return null;
  }
}

// ── Logout ────────────────────────────────────────────────────────────────
export async function logoutEmployee() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      await supabase.from("employee_sessions").delete().eq("token", token);
    } catch (e) {
      console.error("[employee-auth] Failed to delete session:", e.message);
    }
  }
  cookieStore.delete(COOKIE_NAME);
}
