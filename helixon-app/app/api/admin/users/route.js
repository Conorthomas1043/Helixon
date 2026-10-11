import { clerkClient } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanEmail, cleanLine, cleanUuid } from "@/lib/sanitize";
import { reportError } from "@/lib/report-error";
import {
  DEMO_PLAN,
  DEMO_PLANS,
  PASSWORD_ERROR,
  applyClerkAction,
  applyLegacyAction,
  attachBanEnds,
  banEnd,
  isClerkId,
  listAllClerkUsers,
  listClerkUsers,
  listLegacyUsers,
  primaryEmail,
  userHistory,
  validatePassword,
} from "@/lib/admin/users";
import { fields, flag, id, num, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const NewUserInput = fields({
  email: text(320),
  password: text(400),
  firstName: text(200),
  lastName: text(200),
  agencyId: id,
  autoConfirm: flag,
  isTestUser: flag,
  testLabel: text(200),
});
// Read here and by the operations in lib/admin/users.js.
const UserActionInput = fields({
  action: text(40),
  userId: text(128),
  agencyId: id,
  agencyName: text(400),
  plan: text(40),
  days: num,
  reason: text(1000),
  firstName: text(200),
  lastName: text(200),
  password: text(400),
});
const UserDeleteInput = fields({ userId: text(128) });

// The admin console's Users page: list and search accounts (GET), create a
// legacy account (POST), ban, unban, grant demos and the rest (PATCH), and
// delete (DELETE). Each handler checks the admin session (and CSRF for
// writes); the account operations themselves are in lib/admin/users.js.

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();

    const { searchParams } = new URL(request.url);

    const historyFor = cleanLine(searchParams.get("history"), 128);
    if (historyFor) {
      if (!isClerkId(historyFor) && !cleanUuid(historyFor)) return json({ error: "A valid user id is required." }, 400);
      return json({ ok: true, history: await userHistory(supabase, historyFor) });
    }

    // ?page=N pages through Clerk as before; without it, everyone is loaded.
    const paged = searchParams.has("page");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("perPage") || "100", 10) || 100));
    const search = cleanLine(searchParams.get("search"), 100).toLowerCase();

    // Clerk is the source of truth for customers. If Clerk can't be reached the
    // page still loads with the legacy accounts and says so, rather than
    // failing outright.
    let clerkUsers = [];
    let clerkTotal = 0;
    let clerkError = null;
    let truncated = false;
    try {
      const result = paged ? await listClerkUsers(supabase, { page, perPage, search }) : await listAllClerkUsers(supabase, search);
      clerkUsers = result.users;
      clerkTotal = result.totalCount;
      truncated = Boolean(result.truncated);
    } catch (err) {
      reportError("[admin/users] Could not load Clerk users:", err?.message || err);
      clerkError = "Could not load Clerk accounts. Showing legacy accounts only.";
    }

    // The legacy accounts are a small, closed set - list them on the first page.
    const legacyUsers = page === 1 ? await listLegacyUsers(supabase, { page: 1, perPage: 1000, search }) : [];

    return json({
      admin: { username: admin.username },
      page,
      perPage,
      total: clerkTotal + legacyUsers.length,
      truncated,
      clerkError,
      users: await attachBanEnds(supabase, [...clerkUsers, ...legacyUsers]),
    });
  } catch (error) {
    return adminErrorResponse("users", error);
  }
}

// ── Create (legacy Supabase accounts) ───────────────────────────────────────
// NOTE: this still creates a Supabase Auth user, which cannot sign in to the
// app now that login is Clerk. Kept so existing admin tooling doesn't break;
// test accounts that must actually log in should be created by signing up.

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();

    const parsedBody = await parseBody(request, NewUserInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request." }, 400);
    }

    const email = cleanEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = cleanLine(body.firstName, 80);
    const lastName = cleanLine(body.lastName, 80);
    const agencyId = body.agencyId ? cleanUuid(body.agencyId) : null;
    const isTestUser = Boolean(body.isTestUser);
    const testLabel = body.testLabel ? cleanLine(body.testLabel, 80) : null;
    const autoConfirm = body.autoConfirm !== false;

    if (!email) {
      return json({ error: "Valid email is required." }, 400);
    }
    if (!validatePassword(password)) {
      return json({ error: PASSWORD_ERROR }, 400);
    }
    if (!firstName && !lastName) {
      return json({ error: "A first or last name is required." }, 400);
    }
    if (body.agencyId && !agencyId) {
      return json({ error: "agencyId is not valid." }, 400);
    }

    if (agencyId) {
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .maybeSingle();

      if (agencyError) return adminDbError("users", agencyError);
      if (!agency) return json({ error: "Agency not found." }, 404);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: autoConfirm,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
        is_test_user: isTestUser,
        test_label: isTestUser ? testLabel : null,
        admin_created: true,
      },
      app_metadata: {
        is_test_user: isTestUser,
        created_by_admin: admin.username,
      },
    });

    if (error || !data?.user) {
      reportError("[admin/users] createUser failed:", error?.message);
      return json({ error: "Could not create the user. Check the email isn't already registered." }, 400);
    }

    const user = data.user;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName || null,
      last_name: lastName || null,
      agency_id: agencyId,
      username: email,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(user.id);
      return adminDbError("users", profileError);
    }

    const { error: usersError } = await supabase.from("users").upsert({
      id: user.id,
      email,
      full_name: `${firstName} ${lastName}`.trim() || email,
      username: email,
      agency_id: agencyId,
      is_test_user: isTestUser,
      test_label: isTestUser ? testLabel : null,
      test_created_at: isTestUser ? new Date().toISOString() : null,
      test_created_by: isTestUser ? admin.username : null,
    });

    if (usersError) {
      await supabase.auth.admin.deleteUser(user.id);
      return adminDbError("users", usersError);
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: isTestUser ? "create_test_user" : "create_user",
      targetType: "auth_user",
      targetId: user.id,
      targetEmail: email,
      metadata: { firstName, lastName, agencyId, isTestUser, testLabel, autoConfirm },
      request,
    });

    return json({ ok: true, user: { id: user.id, email, isTestUser, testLabel } }, 201);
  } catch (error) {
    return adminErrorResponse("users", error);
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();

    const parsedBody = await parseBody(request, UserActionInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request." }, 400);
    }

    const userId = cleanLine(body.userId, 128);
    const action = cleanLine(body.action, 40);

    const clerk = isClerkId(userId);
    if (!clerk && !cleanUuid(userId)) {
      return json({ error: "A valid userId is required." }, 400);
    }

    let refused = null;
    let targetEmail = null;

    if (clerk) {
      const client = await clerkClient();
      let user;
      try {
        user = await client.users.getUser(userId);
      } catch {
        return json({ error: "User not found." }, 404);
      }
      targetEmail = primaryEmail(user)?.emailAddress || null;
      refused = await applyClerkAction({ client, supabase, userId, action, body, admin });
    } else {
      const { data: currentUserData, error: getError } = await supabase.auth.admin.getUserById(userId);
      if (getError || !currentUserData?.user) {
        return json({ error: "User not found." }, 404);
      }
      targetEmail = currentUserData.user.email || null;
      refused = await applyLegacyAction({ supabase, userId, action, body, currentUser: currentUserData.user });
    }

    if (refused) return json({ error: refused.error }, refused.status);

    // Never the raw request body: for reset_password it contains the new
    // password in plaintext, which would then sit in the audit table forever.
    await writeAdminAudit({
      adminUsername: admin.username,
      action: `user_${action}`,
      targetType: clerk ? "clerk_user" : "auth_user",
      targetId: userId,
      targetEmail,
      metadata:
        action === "reset_password"
          ? { credentialChanged: true }
          : {
              action,
              ...(action === "update_profile" || action === "set_agency" ? { agencyId: body.agencyId ? String(body.agencyId) : null } : {}),
              ...(action === "ban" ? { reason: cleanLine(body.reason, 300) || null, until: banEnd(body) } : {}),
              ...(action === "grant_demo_access" ? { plan: DEMO_PLANS.has(body.plan) ? body.plan : DEMO_PLAN, days: Number(body.days) >= 1 ? Math.min(Number(body.days), 365) : null } : {}),
              ...(action === "provision_agency" ? { agencyName: cleanLine(body.agencyName, 100) } : {}),
            },
      request,
    });

    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("users", error);
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function DELETE(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();

    const parsedBody = await parseBody(request, UserDeleteInput, { allowEmpty: true });
    if (parsedBody.response) return parsedBody.response;
    const body = parsedBody.body;
    const userId = cleanLine(body?.userId, 128);

    const clerk = isClerkId(userId);
    if (!clerk && !cleanUuid(userId)) {
      return json({ error: "A valid userId is required." }, 400);
    }

    let targetEmail = null;

    if (clerk) {
      const client = await clerkClient();
      let user;
      try {
        user = await client.users.getUser(userId);
      } catch {
        return json({ error: "User not found." }, 404);
      }
      targetEmail = primaryEmail(user)?.emailAddress || null;
      // The user.deleted webhook (app/api/webhooks/clerk) detaches their
      // profile, keeping the agency's candidates and billing history.
      await client.users.deleteUser(userId);
    } else {
      const { data: existingData } = await supabase.auth.admin.getUserById(userId);
      const existingUser = existingData?.user;
      if (!existingUser) {
        return json({ error: "User not found." }, 404);
      }
      targetEmail = existingUser.email || null;

      const { error } = await supabase.auth.admin.deleteUser(userId, false);
      if (error) return adminDbError("users", error);
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "delete_user",
      targetType: clerk ? "clerk_user" : "auth_user",
      targetId: userId,
      targetEmail,
      metadata: {},
      request,
    });

    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("users", error);
  }
}
