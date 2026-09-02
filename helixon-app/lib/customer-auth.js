import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabase } from "@/lib/supabase";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
]);

export async function getCustomerContext() {
  const cookieStore = await cookies();

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              cookieStore.set(name, value, options);
            }
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
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
        "id,username,first_name,last_name,agency_id,created_at"
      )
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    throw new Error(
      `Could not load your profile: ${profileError.message}`
    );
  }

  const { data: subscription, error: subscriptionError } =
    await supabase
      .from("subscriptions")
      .select(
        "id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,created_at,updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

  if (subscriptionError) {
    throw new Error(
      `Could not load subscription: ${subscriptionError.message}`
    );
  }

  return {
    user,
    userId: user.id,
    agencyId: profile?.agency_id || null,
    profile: profile || null,
    subscription: subscription || null,
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