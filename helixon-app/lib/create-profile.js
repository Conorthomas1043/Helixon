import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

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
//
// The session id arrives from the client (the success-page URL, or Clerk
// unsafeMetadata), so it can't be trusted as proof the caller paid. Three
// guards stop someone else's - or an already-used - session being claimed:
//   1. If checkout recorded who it was for (metadata.userId/clerkUserId,
//      set when the buyer was already signed in), it must be this caller.
//   2. Guest checkouts have no recorded owner, so the caller must instead
//      prove they own the email that paid: it has to match one of their
//      verified email addresses (`verifiedEmails`). Someone who only has the
//      session id - from a shared link, browser history, a referrer - can't
//      satisfy this. (A session with no email on it falls back to guard 3.)
//   3. A Stripe subscription can only be linked to one profile, so a paid
//      session can't be reused to unlock further accounts. Backed by a
//      unique index (supabase/migrations/*_unique_stripe_subscription_id)
//      so two simultaneous claims can't both succeed.
// Returns { linked: false, reason } when a guard refuses.
export async function linkSubscriptionFromStripeSession({
  profileId,
  stripeSessionId,
  clerkUserId,
  verifiedEmails = [],
}) {
  if (!profileId || !stripeSessionId) return { linked: false };

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return { linked: false };

  const ownerProfileId = session.metadata?.userId || null;
  const ownerClerkId = session.metadata?.clerkUserId || null;
  if (
    (ownerProfileId && ownerProfileId !== profileId) ||
    (ownerClerkId && clerkUserId && ownerClerkId !== clerkUserId)
  ) {
    console.warn(`[link-subscription] Session ${session.id} belongs to a different user - refusing to link.`);
    return { linked: false, reason: "session_belongs_to_another_user" };
  }

  if (!ownerProfileId && !ownerClerkId) {
    const paidEmail = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (paidEmail) {
      const claimantEmails = (verifiedEmails || []).map((e) => String(e).trim().toLowerCase());
      if (!claimantEmails.includes(paidEmail)) {
        console.warn(`[link-subscription] Session ${session.id} was paid with a different email than the claimant's verified emails - refusing to link.`);
        return { linked: false, reason: "email_mismatch" };
      }
    }
  }

  if (session.subscription) {
    const { data: claimedElsewhere, error: claimError } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", session.subscription)
      .neq("user_id", profileId)
      .limit(1);

    if (claimError) throw new Error(claimError.message);
    if (claimedElsewhere?.length) {
      console.warn(`[link-subscription] Subscription ${session.subscription} is already linked to another profile - refusing to link.`);
      return { linked: false, reason: "session_already_claimed" };
    }
  }

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

  if (error) {
    // 23505 = unique_violation: another profile claimed this subscription
    // between the check above and this write (the unique index on
    // stripe_subscription_id is what makes that race safe).
    if (error.code === "23505") {
      console.warn(`[link-subscription] Subscription ${session.subscription} was claimed concurrently - refusing to link.`);
      return { linked: false, reason: "session_already_claimed" };
    }
    throw new Error(error.message);
  }
  return { linked: true, plan };
}
