import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// Turns an email/name into a valid, available `profiles.username`,
// retrying with a numeric suffix on collision. Shared so both the normal
// Clerk-hosted signup (where the user picks a username) and the
// "already logged in, just finish setting up" flow (where nobody ever
// asked them for one) end up with a value that satisfies the same
// USERNAME_RE the webhook already enforces.
export async function generateUsername(seed) {
  const base = (seed || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 16) || "user";

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(100 + Math.random() * 900)}`;
    if (!USERNAME_RE.test(candidate)) continue;

    const { data: existing, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!existing) return candidate;
  }

  throw new Error("Could not generate an available username.");
}

// Creates the `agencies` row and the `profiles` row for a Clerk user who
// doesn't have one yet. Same shape as the old app/api/auth/signup/route.js
// insert, and the same logic app/api/webhooks/clerk/route.js runs on
// `user.created` - pulled out here so the "I'm already logged in, I just
// never finished setup" path (app/api/complete-signup) can reuse it
// instead of re-implementing it.
export async function createProfileAndAgency({
  clerkUserId,
  email,
  firstName,
  lastName,
  username,
  agencyName,
  plan,
}) {
  if (!clerkUserId) throw new Error("clerkUserId is required.");
  if (!USERNAME_RE.test(username || "")) {
    throw new Error("A valid username is required.");
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .insert({
      name: agencyName || `${firstName || "New"}'s agency`,
      intake_email: email || null,
      settings: { plan: plan || "solo", analyses_used: 0 },
    })
    .select("id")
    .single();

  if (agencyError) throw new Error(agencyError.message);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      clerk_user_id: clerkUserId,
      first_name: firstName || null,
      last_name: lastName || null,
      username,
      agency_id: agency.id,
    })
    .select("id")
    .single();

  if (profileError) {
    // Same failure-cleanup pattern as the webhook - don't leave an
    // orphan agency behind if the profile insert fails.
    await supabase.from("agencies").delete().eq("id", agency.id);
    throw new Error(profileError.message);
  }

  return { profileId: profile.id, agencyId: agency.id };
}

// Retrieves a completed Stripe Checkout Session and upserts the
// `subscriptions` row for a profile that didn't exist yet at checkout
// time (a logged-in-but-never-finished-setup user, or a stale/failed
// webhook). Errors are the caller's to decide how to handle - this never
// throws for "session not paid", only for genuine lookup/write failures.
export async function linkSubscriptionFromStripeSession({ profileId, stripeSessionId }) {
  if (!profileId || !stripeSessionId) return { linked: false };

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return { linked: false };

  const plan = session.metadata?.plan;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: profileId,
      plan,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
  return { linked: true, plan };
}
