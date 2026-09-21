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

// Idle timeout, mirroring the sliding-window pattern lib/admin-session.js
// uses: expires_at slides forward on each active check, capped at
// SESSION_HOURS from the session's created_at. Previously expires_at was set
// once at login and never touched again, so a session was a flat 12-hour
// window from login regardless of activity - an actively-working employee
// got signed out mid-shift exactly 12 hours after logging in, and a session
// left open but idle stayed valid for the same fixed 12 hours either way.
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = SESSION_HOURS * 60 * 60 * 1000;

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_USERNAME = 5;
const MAX_FAILURES_PER_IP = 20;

const GENERIC_LOGIN_ERROR = "Incorrect username or password. Please try again.";

// ── Password hashing ─────────────────────────────────────────────────────
export function hashEmployeePassword(password) {
  return bcrypt.hashSync(password, 12);
}

// A real bcrypt hash (cost 12, same as real employee hashes) of a random
// string. Compared against when the username doesn't exist, so an unknown
// username costs the same ~100ms+ as a known one. Without it, the instant
// response for unknown usernames lets an attacker tell which employee
// usernames exist just by timing the login endpoint.
const DUMMY_PASSWORD_HASH = "$2b$12$EcOFc0xxNP4NfQuRkp7itu3fdh3A/NZ5l2Sg7pA/qNlXs0EbIwHyy";

function verifyEmployeePassword(employee, password) {
  const candidate = typeof password === "string" ? password : "";
  if (!employee || !employee.password_hash) {
    bcrypt.compareSync(candidate, DUMMY_PASSWORD_HASH);
    return false;
  }
  if (!candidate) return false;
  return bcrypt.compareSync(candidate, employee.password_hash);
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
  // Starts at the idle window, not the full absolute lifetime - getEmployeeSession()
  // slides this forward on activity, capped at ABSOLUTE_TIMEOUT_MS from created_at.
  const expiresAt = new Date(Date.now() + IDLE_TIMEOUT_MS).toISOString();
  // The cookie's own browser-side expiry is the full absolute window, so the
  // browser keeps sending it for as long as the session could possibly still
  // be valid - actual validity is enforced server-side via expires_at above.
  const cookieExpiresAt = new Date(Date.now() + ABSOLUTE_TIMEOUT_MS);

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
    expires: cookieExpiresAt,
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
//
// Also slides expires_at forward on each active call (using the session as
// counts as activity), capped at ABSOLUTE_TIMEOUT_MS from created_at - same
// sliding-window shape as lib/admin-session.js's idle/absolute pair. Without
// this, expires_at was set once at login and never touched again, so an
// actively-working employee got signed out exactly SESSION_HOURS after
// login regardless of activity, and an idle-but-open session stayed valid
// for that same fixed window instead of a shorter idle cutoff.
export async function getEmployeeSession({ refresh = true } = {}) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { data: session } = await supabase
      .from("employee_sessions")
      .select(
        "id, employee_id, created_at, expires_at, employees(id, username, role, full_name, display_name, is_active, last_login)",
      )
      .eq("token", token)
      .maybeSingle();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;
    if (!session.employees || session.employees.is_active === false) return null;

    if (refresh) {
      const now = Date.now();
      const absoluteCap = new Date(session.created_at).getTime() + ABSOLUTE_TIMEOUT_MS;
      const slid = Math.min(now + IDLE_TIMEOUT_MS, absoluteCap);
      // Only re-issue when it buys at least a few minutes, so a burst of API
      // calls doesn't write to the DB on every single one.
      if (slid - new Date(session.expires_at).getTime() > 5 * 60 * 1000) {
        supabase
          .from("employee_sessions")
          .update({ expires_at: new Date(slid).toISOString() })
          .eq("id", session.id)
          .then(({ error }) => {
            if (error) console.error("[employee-auth] Failed to slide session expiry:", error.message);
          });
      }
    }

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
