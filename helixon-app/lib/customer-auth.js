import { auth } from "@clerk/nextjs/server";

import { supabase } from "@/lib/supabase";
import { getAgencyControls, SUSPENDED_MESSAGE } from "@/lib/agency-controls";
import { ACCESS_STATUSES, grantsAccess } from "@/lib/subscription-status";

const SUBSCRIPTION_COLUMNS = "id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at";

// Same set grantsAccess() uses, so the query and the check can't disagree.
export const ACTIVE_SUBSCRIPTION_STATUSES = ACCESS_STATUSES;

// demo_expires_at arrives with migration 20260929030200; before that every
// demo is open-ended, as it always was.
async function selectSubscriptions(build) {
  let result = await build(`${SUBSCRIPTION_COLUMNS},demo_expires_at`);
  if (result.error?.code === "42703") result = await build(SUBSCRIPTION_COLUMNS);
  return result;
}

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
      await selectSubscriptions((columns) =>
        supabase
          .from("subscriptions")
          .select(columns)
          .eq("user_id", profile.id)
          .maybeSingle()
      );

    if (subscriptionError) {
      throw new Error(
        `Could not load subscription: ${subscriptionError.message}`
      );
    }

    subscription = data;
  }

  // Paid access belongs to the agency, not the individual: only the owner
  // who went through checkout has a subscriptions row, so checking just the
  // caller's own row locked every invited teammate out of screening and
  // email (402 -> /pricing). Anyone whose agency has an active subscription
  // on any member's profile counts as subscribed. `subscription` itself
  // stays the caller's own row - billing management is still owner-only.
  // Demo access (no Stripe subscription) ends at its demo_expires_at.
  let hasActiveSubscription = grantsAccess(subscription);

  if (!hasActiveSubscription && profile?.agency_id) {
    hasActiveSubscription = await agencyHasActiveSubscription(
      profile.agency_id
    );
  }

  // Admin controls on the workspace (suspension, monthly screening cap).
  const controls = await getAgencyControls(profile?.agency_id);

  return {
    user: { id: userId },
    userId,
    agencyId: profile?.agency_id || null,
    profile: profile || null,
    subscription,
    hasActiveSubscription,
    agencySuspended: controls.suspended,
    screeningCap: controls.screeningCap,
  };
}

export async function agencyHasActiveSubscription(agencyId) {
  const { data: members, error: membersError } =
    await supabase
      .from("profiles")
      .select("id")
      .eq("agency_id", agencyId);

  if (membersError) {
    throw new Error(
      `Could not load your agency: ${membersError.message}`
    );
  }

  const memberIds = (members || []).map((m) => m.id);
  if (memberIds.length === 0) return false;

  const { data: subs, error: subsError } =
    await selectSubscriptions((columns) =>
      supabase
        .from("subscriptions")
        .select(columns)
        .in("user_id", memberIds)
        .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES])
        .limit(20)
    );

  if (subsError) {
    throw new Error(
      `Could not load subscription: ${subsError.message}`
    );
  }

  return (subs || []).some((sub) => grantsAccess(sub));
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

  // Suspended from Admin > Agencies: the whole workspace is locked.
  if (context.agencySuspended) {
    return {
      ok: false,
      status: 403,
      suspended: true,
      error: SUSPENDED_MESSAGE,
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
