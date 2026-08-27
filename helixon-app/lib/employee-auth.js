// lib/employee-auth.js
// Mirror of lib/admin-auth.js but for employee sessions.
// Employees are stored in the `employees` table in Supabase.
// Sessions are stored in `employee_sessions` (same pattern as admin_sessions).
//
// Expected Supabase tables (see schema SQL at bottom of this file):
//   employees(id, username, password_hash, role, full_name, created_at)
//   employee_sessions(id, employee_id, token, created_at, expires_at)

import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "employee_session";
const SESSION_HOURS = 12;

// ── Utility ────────────────────────────────────────────────────────────────

function hashPassword(password) {
  // Simple SHA-256 + SALT - match however admin-auth does it.
  // If admin-auth uses bcrypt, switch this to bcrypt too.
  const salt = process.env.PASSWORD_SALT || "helixon_salt";
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function loginEmployee({ username, password }) {
  const hash = hashPassword(password);

  const { data: employee } = await supabase
    .from("employees")
    .select("id, username, role, full_name, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (!employee || employee.password_hash !== hash) {
    return { ok: false, error: "Invalid credentials." };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  await supabase.from("employee_sessions").insert({
    employee_id: employee.id,
    token,
    expires_at: expiresAt,
  });

  // Set cookie
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
      fullName: employee.full_name,
    },
  };
}

// ── Get current session ────────────────────────────────────────────────────

export async function getEmployeeSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { data: session } = await supabase
      .from("employee_sessions")
      .select("employee_id, expires_at, employees(id, username, role, full_name)")
      .eq("token", token)
      .maybeSingle();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;

    return session.employees;
  } catch {
    return null;
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutEmployee() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await supabase.from("employee_sessions").delete().eq("token", token);
    cookieStore.delete(COOKIE_NAME);
  }
}

/* ============================================================
   SUPABASE SCHEMA - run these once in your Supabase SQL editor
   ============================================================

-- Employees table
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  full_name   text not null,
  password_hash text not null,
  role        text not null default 'employee', -- 'employee' | 'manager'
  created_at  timestamptz default now()
);

-- Employee sessions
create table if not exists employee_sessions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  token       text unique not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null
);

-- Employee to-do items
create table if not exists employee_todos (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  title       text not null,
  notes       text,
  priority    text not null default 'medium',  -- 'low' | 'medium' | 'high'
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Request log (written by middleware via edge-log route)
create table if not exists request_logs (
  id          bigint generated always as identity primary key,
  ip          text,
  user_agent  text,
  method      text,
  path        text,
  country     text,
  city        text,
  referer     text,
  blocked     boolean default false,
  ts          timestamptz default now()
);
create index if not exists request_logs_ts_idx on request_logs(ts desc);
create index if not exists request_logs_ip_idx on request_logs(ip);

-- Security events (already referenced in your existing security route)
create table if not exists security_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  severity    text not null default 'medium',
  ip          text,
  detail      jsonb,
  resolved    boolean default false,
  ts          timestamptz default now()
);

-- Blocked IPs (already referenced in your existing security route)
create table if not exists blocked_ips (
  ip          text primary key,
  reason      text,
  blocked_by  text,
  blocked_at  timestamptz default now()
);

-- Login attempts (already referenced in your existing security route)
create table if not exists login_attempts (
  id          bigint generated always as identity primary key,
  ip          text,
  username    text,
  login_type  text,  -- 'admin' | 'employee' | 'agency'
  success     boolean,
  ts          timestamptz default now()
);
create index if not exists login_attempts_ts_idx on login_attempts(ts desc);

============================================================ */