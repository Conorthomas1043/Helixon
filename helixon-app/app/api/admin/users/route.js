import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAudit } from "@/lib/admin-audit";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function validateEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();

    const { searchParams } = new URL(request.url);

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10)
    );

    const perPage = Math.min(
      1000,
      Math.max(
        1,
        Number.parseInt(searchParams.get("perPage") || "100", 10)
      )
    );

    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (authError) {
      return json({ error: authError.message }, 500);
    }

    let users = authData?.users || [];

    if (search) {
      users = users.filter((user) => {
        const email = (user.email || "").toLowerCase();
        const id = (user.id || "").toLowerCase();

        const firstName = (
          user.user_metadata?.first_name || ""
        ).toLowerCase();

        const lastName = (
          user.user_metadata?.last_name || ""
        ).toLowerCase();

        return (
          email.includes(search) ||
          id.includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search)
        );
      });
    }

    const ids = users.map((user) => user.id);

    let profiles = [];
    let subscriptions = [];

    if (ids.length) {
      const profileResult = await supabase
        .from("profiles")
        .select(
          "id,username,first_name,last_name,agency_id,created_at"
        )
        .in("id", ids);

      if (profileResult.error) {
        return json(
          { error: profileResult.error.message },
          500
        );
      }

      profiles = profileResult.data || [];

      const subscriptionResult = await supabase
        .from("subscriptions")
        .select(
          "id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at"
        )
        .in("user_id", ids);

      if (subscriptionResult.error) {
        return json(
          { error: subscriptionResult.error.message },
          500
        );
      }

      subscriptions = subscriptionResult.data || [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile])
    );

    const subscriptionMap = new Map(
      subscriptions.map((subscription) => [
        subscription.user_id,
        subscription,
      ])
    );

    return json({
      admin: {
        username: admin.username,
      },
      page,
      perPage,
      users: users.map((user) => {
        const profile = profileMap.get(user.id);
        const subscription = subscriptionMap.get(user.id);

        return {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastSignInAt: user.last_sign_in_at,
          emailConfirmedAt: user.email_confirmed_at,
          phoneConfirmedAt: user.phone_confirmed_at,
          bannedUntil: user.banned_until,
          isAnonymous: Boolean(user.is_anonymous),

          firstName:
            profile?.first_name ||
            user.user_metadata?.first_name ||
            "",

          lastName:
            profile?.last_name ||
            user.user_metadata?.last_name ||
            "",

          username: profile?.username || "",

          agency: profile?.agency_id
            ? {
                id: profile.agency_id,
              }
            : null,

          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                plan: subscription.plan,
                stripeCustomerId:
                  subscription.stripe_customer_id,
                stripeSubscriptionId:
                  subscription.stripe_subscription_id,
                createdAt: subscription.created_at,
                updatedAt: subscription.updated_at,
              }
            : null,

          isTestUser: Boolean(
            user.user_metadata?.is_test_user
          ),

          testLabel:
            user.user_metadata?.test_label || null,
        };
      }),
    });
  } catch (error) {
    const status =
      error?.message === "Unauthorized" ? 401 : 500;

    return json(
      { error: error?.message || "Internal server error" },
      status
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

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const agencyId = body.agencyId
      ? String(body.agencyId)
      : null;

    const isTestUser = Boolean(body.isTestUser);
    const testLabel = body.testLabel
      ? String(body.testLabel).trim()
      : null;

    const autoConfirm = body.autoConfirm !== false;

    if (!validateEmail(email)) {
      return json({ error: "Valid email is required." }, 400);
    }

    if (!validatePassword(password)) {
      return json(
        { error: "Password must be at least 8 characters." },
        400
      );
    }

    if (!firstName && !lastName) {
      return json(
        { error: "A first or last name is required." },
        400
      );
    }

    if (agencyId) {
      const { data: agency, error: agencyError } =
        await supabase
          .from("agencies")
          .select("id")
          .eq("id", agencyId)
          .maybeSingle();

      if (agencyError) {
        return json(
          { error: agencyError.message },
          500
        );
      }

      if (!agency) {
        return json(
          { error: "Agency not found." },
          404
        );
      }
    }

    const { data, error } =
      await supabase.auth.admin.createUser({
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
      return json(
        {
          error:
            error?.message ||
            "Supabase could not create the user.",
        },
        400
      );
    }

    const user = data.user;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        first_name: firstName || null,
        last_name: lastName || null,
        agency_id: agencyId,
        username: email,
      });

    if (profileError) {
      await supabase.auth.admin.deleteUser(user.id);

      return json(
        {
          error:
            "User was created but profile creation failed: " +
            profileError.message,
        },
        500
      );
    }

    const { error: usersError } = await supabase
      .from("users")
      .upsert({
        id: user.id,
        email,
        full_name:
          `${firstName} ${lastName}`.trim() || email,
        username: email,
        agency_id: agencyId,
        is_test_user: isTestUser,
        test_label: isTestUser ? testLabel : null,
        test_created_at: isTestUser
          ? new Date().toISOString()
          : null,
        test_created_by: isTestUser
          ? admin.username
          : null,
      });

    if (usersError) {
      await supabase.auth.admin.deleteUser(user.id);

      return json(
        {
          error:
            "User was created but application-user creation failed: " +
            usersError.message,
        },
        500
      );
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: isTestUser
        ? "create_test_user"
        : "create_user",
      targetType: "auth_user",
      targetId: user.id,
      targetEmail: email,
      metadata: {
        firstName,
        lastName,
        agencyId,
        isTestUser,
        testLabel,
        autoConfirm,
      },
      request,
    });

    return json(
      {
        ok: true,
        user: {
          id: user.id,
          email,
          isTestUser,
          testLabel,
        },
      },
      201
    );
  } catch (error) {
    const status =
      error?.message === "Unauthorized" ? 401 : 500;

    return json(
      { error: error?.message || "Internal server error" },
      status
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

    const userId = String(body.userId || "").trim();
    const action = String(body.action || "").trim();

    if (!userId) {
      return json({ error: "userId is required." }, 400);
    }

    const { data: currentUserData, error: getError } =
      await supabase.auth.admin.getUserById(userId);

    if (getError || !currentUserData?.user) {
      return json(
        {
          error:
            getError?.message || "User not found.",
        },
        404
      );
    }

    const currentUser = currentUserData.user;

    if (action === "confirm_email") {
      const { error } =
        await supabase.auth.admin.updateUserById(
          userId,
          { email_confirm: true }
        );

      if (error) {
        return json({ error: error.message }, 400);
      }
    }

    else if (action === "ban") {
      const { error } =
        await supabase.auth.admin.updateUserById(
          userId,
          { ban_duration: "876000h" }
        );

      if (error) {
        return json({ error: error.message }, 400);
      }
    }

    else if (action === "unban") {
      const { error } =
        await supabase.auth.admin.updateUserById(
          userId,
          { ban_duration: "none" }
        );

      if (error) {
        return json({ error: error.message }, 400);
      }
    }

    else if (action === "reset_password") {
      const password = String(body.password || "");

      if (!validatePassword(password)) {
        return json(
          {
            error:
              "Password must be at least 8 characters.",
          },
          400
        );
      }

      const { error } =
        await supabase.auth.admin.updateUserById(
          userId,
          { password }
        );

      if (error) {
        return json({ error: error.message }, 400);
      }
    }

    else if (action === "update_profile") {
      const firstName = String(
        body.firstName || ""
      ).trim();

      const lastName = String(
        body.lastName || ""
      ).trim();

      const agencyId = body.agencyId
        ? String(body.agencyId)
        : null;

      const { error: profileError } =
        await supabase
          .from("profiles")
          .update({
            first_name: firstName || null,
            last_name: lastName || null,
            agency_id: agencyId,
          })
          .eq("id", userId);

      if (profileError) {
        return json(
          { error: profileError.message },
          500
        );
      }

      const { error: usersError } =
        await supabase
          .from("users")
          .update({
            full_name:
              `${firstName} ${lastName}`.trim() ||
              currentUser.email ||
              "",
            agency_id: agencyId,
          })
          .eq("id", userId);

      if (usersError) {
        return json(
          { error: usersError.message },
          500
        );
      }
    }

    else {
      return json(
        { error: "Unknown admin user action." },
        400
      );
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: `user_${action}`,
      targetType: "auth_user",
      targetId: userId,
      targetEmail: currentUser.email || null,
      metadata: body,
      request,
    });

    return json({ ok: true });
  } catch (error) {
    const status =
      error?.message === "Unauthorized" ? 401 : 500;

    return json(
      { error: error?.message || "Internal server error" },
      status
    );
  }
}

export async function DELETE(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }
    const supabase = getAdminSupabase();

    const body = await request.json();

    const userId = String(body.userId || "").trim();

    if (!userId) {
      return json({ error: "userId is required." }, 400);
    }

    const { data: existingData } =
      await supabase.auth.admin.getUserById(userId);

    const existingUser = existingData?.user;

    if (!existingUser) {
      return json(
        { error: "User not found." },
        404
      );
    }

    const { error } =
      await supabase.auth.admin.deleteUser(
        userId,
        false
      );

    if (error) {
      return json(
        { error: error.message },
        400
      );
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "delete_user",
      targetType: "auth_user",
      targetId: userId,
      targetEmail: existingUser.email || null,
      metadata: {},
      request,
    });

    return json({ ok: true });
  } catch (error) {
    const status =
      error?.message === "Unauthorized" ? 401 : 500;

    return json(
      { error: error?.message || "Internal server error" },
      status
    );
  }
}