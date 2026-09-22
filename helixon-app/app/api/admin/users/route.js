import { clerkClient } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanEmail, cleanLine, cleanUuid } from "@/lib/sanitize";
import { createProfileAndAgency, generateUsername } from "@/lib/create-profile";

// Customers now sign in through Clerk, so real accounts live in Clerk (mirrored
// in `profiles` by clerk_user_id). This route used to manage ONLY Supabase Auth
// users - the pre-migration accounts - which meant an admin couldn't see, ban or
// delete any actual customer. It now lists and manages both:
//   - Clerk users        ids look like "user_2abc..."   (provider: "clerk")
//   - legacy Supabase    ids are UUIDs                  (provider: "supabase")
// Which one an action applies to is decided by the shape of the id.

const MIN_PASSWORD_LENGTH = 12;
const PASSWORD_ERROR = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

// "Banned" is shown in the UI as a date; Clerk only has a boolean.
const CLERK_BANNED_MARKER = "9999-12-31T00:00:00.000Z";

function validatePassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH && password.length <= 200;
}

function isClerkId(id) {
  return typeof id === "string" && /^user_[A-Za-z0-9]+$/.test(id);
}

function iso(ms) {
  return typeof ms === "number" ? new Date(ms).toISOString() : null;
}

function primaryEmail(user) {
  const emails = user.emailAddresses || [];
  return emails.find((e) => e.id === user.primaryEmailAddressId) || emails[0] || null;
}

// ── Listing ─────────────────────────────────────────────────────────────────

async function listLegacyUsers(supabase, { page, perPage, search }) {
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page, perPage });
  if (authError) throw new Error(authError.message);

  let users = authData?.users || [];

  if (search) {
    users = users.filter((user) => {
      const haystack = [
        user.email,
        user.id,
        user.user_metadata?.first_name,
        user.user_metadata?.last_name,
      ]
        .map((v) => (v || "").toLowerCase());
      return haystack.some((v) => v.includes(search));
    });
  }

  const ids = users.map((u) => u.id);
  if (!ids.length) return [];

  const [profileResult, subscriptionResult] = await Promise.all([
    supabase.from("profiles").select("id,username,first_name,last_name,agency_id,created_at").in("id", ids),
    supabase
      .from("subscriptions")
      .select("id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at")
      .in("user_id", ids),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);

  const profileMap = new Map((profileResult.data || []).map((p) => [p.id, p]));
  const subscriptionMap = new Map((subscriptionResult.data || []).map((s) => [s.user_id, s]));

  return users.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      provider: "supabase",
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastSignInAt: user.last_sign_in_at,
      emailConfirmedAt: user.email_confirmed_at,
      phoneConfirmedAt: user.phone_confirmed_at,
      bannedUntil: user.banned_until,
      isAnonymous: Boolean(user.is_anonymous),
      firstName: profile?.first_name || user.user_metadata?.first_name || "",
      lastName: profile?.last_name || user.user_metadata?.last_name || "",
      username: profile?.username || "",
      agency: profile?.agency_id ? { id: profile.agency_id } : null,
      subscription: shapeSubscription(subscriptionMap.get(user.id)),
      isTestUser: Boolean(user.user_metadata?.is_test_user),
      testLabel: user.user_metadata?.test_label || null,
    };
  });
}

async function listClerkUsers(supabase, { page, perPage, search }) {
  const client = await clerkClient();
  const { data: clerkUsers, totalCount } = await client.users.getUserList({
    limit: perPage,
    offset: (page - 1) * perPage,
    orderBy: "-created_at",
    ...(search ? { query: search } : {}),
  });

  const clerkIds = clerkUsers.map((u) => u.id);
  let profiles = [];
  let subscriptions = [];

  if (clerkIds.length) {
    const profileResult = await supabase
      .from("profiles")
      .select("id,clerk_user_id,username,first_name,last_name,agency_id,created_at")
      .in("clerk_user_id", clerkIds);
    if (profileResult.error) throw new Error(profileResult.error.message);
    profiles = profileResult.data || [];

    const profileIds = profiles.map((p) => p.id);
    if (profileIds.length) {
      const subscriptionResult = await supabase
        .from("subscriptions")
        .select("id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at")
        .in("user_id", profileIds);
      if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);
      subscriptions = subscriptionResult.data || [];
    }
  }

  const profileByClerkId = new Map(profiles.map((p) => [p.clerk_user_id, p]));
  const subscriptionByProfileId = new Map(subscriptions.map((s) => [s.user_id, s]));

  const users = clerkUsers.map((user) => {
    const profile = profileByClerkId.get(user.id);
    const email = primaryEmail(user);
    return {
      provider: "clerk",
      id: user.id,
      email: email?.emailAddress || "",
      createdAt: iso(user.createdAt),
      updatedAt: iso(user.updatedAt),
      lastSignInAt: iso(user.lastSignInAt),
      emailConfirmedAt: email?.verification?.status === "verified" ? iso(user.createdAt) : null,
      phoneConfirmedAt: null,
      bannedUntil: user.banned ? CLERK_BANNED_MARKER : null,
      isAnonymous: false,
      firstName: profile?.first_name || user.firstName || "",
      lastName: profile?.last_name || user.lastName || "",
      username: profile?.username || user.username || "",
      agency: profile?.agency_id ? { id: profile.agency_id } : null,
      subscription: shapeSubscription(profile ? subscriptionByProfileId.get(profile.id) : null),
      isTestUser: Boolean(user.publicMetadata?.is_test_user),
      testLabel: user.publicMetadata?.test_label || null,
    };
  });

  return { users, totalCount };
}

function shapeSubscription(subscription) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status,
    plan: subscription.plan,
    stripeCustomerId: subscription.stripe_customer_id,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
  };
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("perPage") || "100", 10) || 100));
    const search = cleanLine(searchParams.get("search"), 100).toLowerCase();

    // Clerk is the source of truth for customers. If Clerk can't be reached the
    // page still loads with the legacy accounts and says so, rather than
    // failing outright.
    let clerkUsers = [];
    let clerkTotal = 0;
    let clerkError = null;
    try {
      const result = await listClerkUsers(supabase, { page, perPage, search });
      clerkUsers = result.users;
      clerkTotal = result.totalCount;
    } catch (err) {
      console.error("[admin/users] Could not load Clerk users:", err?.message || err);
      clerkError = "Could not load Clerk accounts. Showing legacy accounts only.";
    }

    // The legacy accounts are a small, closed set - list them on the first page.
    const legacyUsers = page === 1 ? await listLegacyUsers(supabase, { page: 1, perPage: 1000, search }) : [];

    return json({
      admin: { username: admin.username },
      page,
      perPage,
      total: clerkTotal + legacyUsers.length,
      clerkError,
      users: [...clerkUsers, ...legacyUsers],
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

    const body = await request.json().catch(() => null);
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
      console.error("[admin/users] createUser failed:", error?.message);
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

// ── Update ──────────────────────────────────────────────────────────────────

async function applyClerkAction({ client, supabase, userId, action, body }) {
  if (action === "ban") {
    await client.users.banUser(userId);
  } else if (action === "unban") {
    await client.users.unbanUser(userId);
  } else if (action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!validatePassword(password)) return { status: 400, error: PASSWORD_ERROR };
    try {
      await client.users.updateUser(userId, { password });
    } catch (err) {
      // Clerk enforces its own password rules (e.g. rejects breached
      // passwords). That message is about the admin's input and safe to show.
      const reason = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message;
      if (err?.status === 422 || err?.status === 400) {
        return { status: 400, error: reason || "Clerk rejected that password." };
      }
      throw err;
    }
  } else if (action === "update_profile") {
    const firstName = cleanLine(body.firstName, 80);
    const lastName = cleanLine(body.lastName, 80);
    const agencyId = body.agencyId ? cleanUuid(body.agencyId) : null;
    if (body.agencyId && !agencyId) return { status: 400, error: "agencyId is not valid." };

    if (agencyId) {
      const { data: agency, error } = await supabase.from("agencies").select("id").eq("id", agencyId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!agency) return { status: 404, error: "Agency not found." };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: firstName || null, last_name: lastName || null, agency_id: agencyId })
      .eq("clerk_user_id", userId);
    if (profileError) throw new Error(profileError.message);

    await client.users.updateUser(userId, { firstName, lastName });
  } else if (action === "provision_agency") {
    return provisionAgency({ client, supabase, userId, body });
  } else if (action === "grant_demo_access") {
    return grantDemoAccess({ client, supabase, userId });
  } else if (action === "revoke_demo_access") {
    return revokeDemoAccess({ supabase, userId });
  } else if (action === "confirm_email") {
    return { status: 400, error: "Clerk verifies email addresses itself - there is nothing to confirm." };
  } else {
    return { status: 400, error: "Unknown admin user action." };
  }
  return null;
}

// Gives a Clerk account the agency + profile rows the app needs. Normally these
// are created by the Clerk webhook / checkout; when that never happened (a
// missed webhook, an account that signed up without checking out) the person
// can sign in but every agency-scoped page answers 403. This is the support
// tool for that. It does NOT create a subscription - billing is unchanged.
async function provisionAgency({ client, supabase, userId, body }) {
  const agencyName = cleanLine(body.agencyName, 100);
  if (!agencyName) return { status: 400, error: "An agency name is required." };

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id,agency_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.agency_id) return { status: 409, error: "This account already has an agency." };

  const user = await client.users.getUser(userId);
  const email = primaryEmail(user)?.emailAddress || null;

  if (!existing) {
    const username = await generateUsername(user.username || email?.split("@")[0] || user.firstName);
    await createProfileAndAgency({
      clerkUserId: userId,
      email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      username,
      agencyName,
      plan: null,
    });
    return null;
  }

  // A profile exists but was never given an agency.
  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .insert({ name: agencyName, intake_email: email, settings: { plan: "solo", analyses_used: 0 } })
    .select("id")
    .single();
  if (agencyError) throw new Error(agencyError.message);

  const { error: linkError } = await supabase.from("profiles").update({ agency_id: agency.id }).eq("id", existing.id);
  if (linkError) {
    await supabase.from("agencies").delete().eq("id", agency.id); // don't leave an orphan behind
    throw new Error(linkError.message);
  }
  return null;
}

// Unlocks full paid access for a demo/sales account with no real payment -
// app/api/run's requireCustomerContext({ requireSubscription: true }) only
// checks for a `subscriptions` row with status "active"; it has no idea
// whether Stripe was ever involved. This writes exactly that row, with no
// Stripe customer/subscription id, and tags the account in Clerk's
// publicMetadata.is_test_user (the same flag the Users table's "Test" pill
// already reads - see listClerkUsers above). Billing is completely
// untouched: no Stripe object is created, so there's nothing to cancel or
// refund later, only this row to revoke.
const DEMO_PLAN = "agency"; // the fuller of the two real plans - a demo should show everything

async function grantDemoAccess({ client, supabase, userId }) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, agency_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) return { status: 404, error: "This account has no profile yet." };
  if (!profile.agency_id) {
    return { status: 409, error: "This account has no agency yet - use “Set up agency” first." };
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: profile.id,
      plan: DEMO_PLAN,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  await client.users.updateUser(userId, {
    publicMetadata: { is_test_user: true, test_label: "Demo access (no payment)" },
  });

  return null;
}

// The mirror of grantDemoAccess - deliberately scoped to rows with no
// Stripe subscription id, so this can never cancel a real paying
// customer's subscription even if called on the wrong account by mistake.
async function revokeDemoAccess({ supabase, userId }) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) return null;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("stripe_subscription_id", null);
  if (error) throw new Error(error.message);

  return null;
}

async function applyLegacyAction({ supabase, userId, action, body, currentUser }) {
  if (action === "confirm_email") {
    const { error } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) throw new Error(error.message);
  } else if (action === "ban") {
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (error) throw new Error(error.message);
  } else if (action === "unban") {
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) throw new Error(error.message);
  } else if (action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!validatePassword(password)) return { status: 400, error: PASSWORD_ERROR };
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
  } else if (action === "update_profile") {
    const firstName = cleanLine(body.firstName, 80);
    const lastName = cleanLine(body.lastName, 80);
    const agencyId = body.agencyId ? cleanUuid(body.agencyId) : null;
    if (body.agencyId && !agencyId) return { status: 400, error: "agencyId is not valid." };

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: firstName || null, last_name: lastName || null, agency_id: agencyId })
      .eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    const { error: usersError } = await supabase
      .from("users")
      .update({
        full_name: `${firstName} ${lastName}`.trim() || currentUser.email || "",
        agency_id: agencyId,
      })
      .eq("id", userId);
    if (usersError) throw new Error(usersError.message);
  } else {
    return { status: 400, error: "Unknown admin user action." };
  }
  return null;
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
      refused = await applyClerkAction({ client, supabase, userId, action, body });
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
              ...(action === "update_profile" ? { agencyId: body.agencyId ? String(body.agencyId) : null } : {}),
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

    const body = await request.json().catch(() => null);
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
