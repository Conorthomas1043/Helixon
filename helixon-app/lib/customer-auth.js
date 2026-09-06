import { auth } from "@clerk/nextjs/server";

import { supabase } from "@/lib/supabase";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
]);

// Identity comes from Clerk (auth() reads the session Clerk's middleware
// already validated for this request). Everything else - profile, agency,
// subscription/billing status - still lives in Postgres via Supabase, which
// is why `supabase` (the service-role client) is still used here even
// though Supabase Auth itself is no longer the identity provider.
//
// Rows are looked up by `clerk_user_id` rather than the old `id` (which
// used to be the Supabase auth.users uuid). See
// supabase/migrations/*_add_clerk_user_id.sql - existing rows need that
// column backfilled as part of the user migration to Clerk.
export async function getCustomerContext() {
  const { userId } = await auth();

  if (!userId) {
    return {
      user: null,
      userId: null,
      agencyId: null,
      profile: null,
      subscription: null,
      hasActiveSubscription: false,
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select(
        "id,clerk_user_id,username,first_name,last_name,agency_id,created_at"
      )
      .eq("clerk_user_id", userId)
      .maybeSingle();

  if (profileError) {
    throw new Error(
      `Could not load your profile: ${profileError.message}`
    );
  }

  // subscriptions.user_id is a uuid FK to profiles.id - it is never the
  // Clerk user id (e.g. "user_..."), so there is nothing to look up
  // without a profile row. Querying with the Clerk id here previously
  // caused `invalid input syntax for type uuid` whenever a profile
  // hadn't been created/linked yet (e.g. before the Clerk webhook fires).
  let subscription = null;

  if (profile?.id) {
    const { data, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select(
          "id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at"
        )
        .eq("user_id", profile.id)
        .maybeSingle();

    if (subscriptionError) {
      throw new Error(
        `Could not load subscription: ${subscriptionError.message}`
      );
    }

    subscription = data;
  }

  return {
    user: { id: userId },
    userId,
    agencyId: profile?.agency_id || null,
    profile: profile || null,
    subscription,
    hasActiveSubscription: ACTIVE_SUBSCRIPTION_STATUSES.has(
      subscription?.status
    ),
  };
}

export async function requireCustomerContext({
  requireSubscription = false,
} = {}) {
  const context = await getCustomerContext();

  if (!context.user) {
    return {
      ok: false,
      status: 401,
      error: "Please sign in to continue.",
    };
  }

  if (!context.agencyId) {
    return {
      ok: false,
      status: 403,
      error:
        "Your account is not connected to an agency. Please contact Helixon support.",
    };
  }

  if (
    requireSubscription &&
    !context.hasActiveSubscription
  ) {
    return {
      ok: false,
      status: 402,
      upgrade: true,
      error:
        "An active Helixon subscription is required to use candidate screening.",
    };
  }

  return {
    ok: true,
    ...context,
  };
}
