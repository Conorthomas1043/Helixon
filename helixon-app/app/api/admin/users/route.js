// app/api/admin/users/route.js
//
// Admin-only endpoint for managing tool users (mainly test/trial accounts).
// Uses the Supabase service-role client, so this file must NEVER be imported
// client-side and the service role key must stay server-only (env var, not
// NEXT_PUBLIC_*).
//
// Auth: requireAdminSession() reads the admin session cookie set by
// /api/admin/login. It does NOT take a request argument and it does NOT
// return { ok }. It either returns the session object or throws — so every
// handler below wraps the call in try/catch and 401s on failure.
//
// Schema note: there is no separate "agency_users" join table — agency
// linkage lives directly on public.users (id, agency_id, email, full_name,
// created_at). This route reads/writes that table directly. It assumes a
// trigger creates a public.users row when an auth user is created (common
// Supabase pattern); we upsert rather than insert so this still works
// whether or not that row already exists.
//
// Username/password accounts: Supabase Auth requires an email under the
// hood, so we synthesize one from the username (USERNAME_DOMAIN below) and
// never surface it anywhere — admins only ever see/enter a username. The
// real, human-chosen username is stored in users.username and is what the
// rest of the admin UI should display and search on.
//
// Required migration (run once):
//   alter table public.users
//     add column username text unique,
//     add column is_test_user boolean not null default false;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Suspension is implemented via Supabase's ban_duration on the auth user
// (an effectively-permanent ban: "876000h" ≈ 100 years). Unsuspending clears it.
const SUSPEND_DURATION = "876000h";

// Internal-only email domain used to satisfy Supabase Auth's email
// requirement for username/password accounts. Never shown in the UI.
const USERNAME_DOMAIN = "users.helixon.internal";

function usernameToEmail(username) {
  return `${username.toLowerCase()}@${USERNAME_DOMAIN}`;
}

function isSyntheticEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${USERNAME_DOMAIN}`);
}

function emailToUsername(email) {
  return email.split("@")[0];
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

async function requireAdmin() {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}

function serializeUser(authUser, profileRow) {
  // Prefer the stored username off the public.users row; fall back to
  // deriving it from the synthetic email for accounts created before that
  // column existed.
  const username =
    profileRow?.username || (isSyntheticEmail(authUser.email) ? emailToUsername(authUser.email) : null);

  return {
    id: authUser.id,
    username,
    // Only expose a real email if it's an actual email (legacy accounts);
    // synthetic ones are an implementation detail.
    email: isSyntheticEmail(authUser.email) ? null : authUser.email,
    full_name: profileRow?.full_name ?? null,
    created_at: authUser.created_at,
    last_sign_in_at: authUser.last_sign_in_at,
    suspended: !!authUser.banned_until && new Date(authUser.banned_until) > new Date(),
    agency_id: profileRow?.agency_id ?? null,
    is_test_user: profileRow?.is_test_user ?? false,
  };
}

// ── GET: list users ──────────────────────────────────────────────────────
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    // Supabase Admin API paginates; for an admin tool this scale is fine.
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const ids = data.users.map((u) => u.id);
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, agency_id, is_test_user, username, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (profileErr) throw profileErr;

    const profileByUser = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    const users = data.users
      .map((u) => serializeUser(u, profileByUser[u.id]))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── POST: create a test user (username + password) ───────────────────────
export async function POST(req) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { username, password, agencyId, isTestUser = true } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Username and password are required" }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { ok: false, error: "Username must be 3-32 characters: letters, numbers, underscore, period, or hyphen" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const syntheticEmail = usernameToEmail(username);

    // Make sure the username isn't already taken before hitting Supabase
    // Auth, so we can give a clean error instead of a generic "user exists".
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: false, error: "Username is already taken" }, { status: 409 });
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true, // skip verification email — there's no real inbox behind this address
      user_metadata: { username },
    });
    if (error) {
      // Supabase will say "email already exists" — translate that back to
      // username terms since the admin never typed an email.
      if (/already.*registered|already.*exists/i.test(error.message)) {
        return NextResponse.json({ ok: false, error: "Username is already taken" }, { status: 409 });
      }
      throw error;
    }

    let resolvedAgencyId = agencyId;

    // No agency picked → spin up a lightweight test agency so the new user
    // has somewhere to attach to and immediately gets tool access.
    if (!resolvedAgencyId) {
      const { data: newAgency, error: agencyErr } = await supabaseAdmin
        .from("agencies")
        .insert({ name: `Test account — ${username}`, intake_email: syntheticEmail })
        .select()
        .single();
      if (agencyErr) throw agencyErr;
      resolvedAgencyId = newAgency.id;
    }

    // public.users may already have a row for this id (created by an
    // auth.users insert trigger, if one exists) — upsert so this works
    // either way, rather than assuming insert vs update.
    const { error: profileErr } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: created.user.id,
          email: syntheticEmail,
          agency_id: resolvedAgencyId,
          is_test_user: isTestUser,
          username,
        },
        { onConflict: "id" }
      );
    if (profileErr) throw profileErr;

    return NextResponse.json({
      ok: true,
      user: serializeUser(created.user, { agency_id: resolvedAgencyId, is_test_user: isTestUser, username }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── PATCH: suspend / unsuspend / reset password ──────────────────────────
export async function PATCH(req) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { action, userId, newPassword } = await req.json();
    if (!userId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

    if (action === "suspend") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: SUSPEND_DURATION });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "unsuspend") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── DELETE: permanently remove a user ────────────────────────────────────
export async function DELETE(req) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

    await supabaseAdmin.from("users").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}