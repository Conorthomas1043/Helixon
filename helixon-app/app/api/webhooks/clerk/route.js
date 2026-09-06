import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { createProfileAndAgency, linkSubscriptionFromStripeSession } from "@/lib/create-profile";

// Replaces app/api/auth/signup/route.js's job of creating the `agencies`
// row and the `profiles` row. Under Supabase Auth that happened inline in
// the signup request (via a Postgres trigger on auth.users); under Clerk,
// account creation is a black box the app doesn't control the timing of
// (email verification, OAuth, etc. can all finish it), so this webhook -
// fired by Clerk once the account is actually created - is the reliable
// place to do it instead.
//
// Setup required in the Clerk dashboard: Webhooks -> Add endpoint ->
//   https://<your-domain>/api/webhooks/clerk
// Subscribe to: user.created (required), user.deleted (optional, see below)
// Copy the "Signing secret" into CLERK_WEBHOOK_SECRET.
//
// agencyName/username/firstName/lastName arrive via `unsafeMetadata`,
// which the signup form (app/signup) sets on the Clerk sign-up attempt
// before submitting. It's client-supplied, exactly like the old signup
// route's request body was - so it's still validated here, same as before.

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export async function POST(request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[clerk webhook] CLERK_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ ok: false, error: "Webhook not configured." }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "Missing svix headers." }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("[clerk webhook] Signature verification failed:", err.message);
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "user.created") {
      await handleUserCreated(event.data);
    } else if (event.type === "user.deleted") {
      // Soft-disconnect rather than delete - keeps candidates/subscriptions
      // history intact for the agency even if a user account is removed.
      await supabase
        .from("profiles")
        .update({ clerk_user_id: null })
        .eq("clerk_user_id", event.data.id);
    }
  } catch (err) {
    console.error(`[clerk webhook] Failed handling ${event.type}:`, err.message);
    // 500 tells Clerk to retry the webhook delivery.
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleUserCreated(clerkUser) {
  const clerkUserId = clerkUser.id;
  const email = clerkUser.email_addresses?.find(
    (e) => e.id === clerkUser.primary_email_address_id
  )?.email_address?.toLowerCase() || null;

  const meta = clerkUser.unsafe_metadata || {};
  const firstName = (meta.firstName || clerkUser.first_name || "").trim();
  const lastName = (meta.lastName || clerkUser.last_name || "").trim();
  // meta.username (unsafe_metadata) is only ever set for the pre-Clerk
  // custom signup wizard this replaced. The current app/signup collects
  // username via Clerk's own hosted <SignUp/> field, which arrives here as
  // clerkUser.username directly - not under unsafe_metadata. Without this
  // fallback, `username` was always empty for every real signup, which
  // fails USERNAME_RE below and silently skips profile/agency/subscription
  // creation for a customer who already paid.
  const username = (meta.username || clerkUser.username || "").trim().toLowerCase();
  const agencyName = (meta.agencyName || "").trim();

  // ── Case 1: this username already has a profile (pre-Clerk account
  // being migrated - see the migration SQL's backfill note). Link it
  // instead of creating a duplicate agency/profile.
  //
  // NOTE: matched on `username`, not email - the original `profiles`
  // schema (created directly in the Supabase dashboard, not tracked in
  // this repo) is not confirmed to have an `email` column, since the old
  // code always read email off the Supabase Auth user object rather than
  // `profiles`. If you do have an `email` column on `profiles`, matching
  // on that instead is more reliable (usernames could theoretically be
  // reused by a different person) - swap `.eq("username", username)`
  // below for `.eq("email", email)` in that case.
  if (username) {
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id, clerk_user_id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);

    if (existing && !existing.clerk_user_id) {
      const { error: linkError } = await supabase
        .from("profiles")
        .update({ clerk_user_id: clerkUserId })
        .eq("id", existing.id);
      if (linkError) throw new Error(linkError.message);
      return;
    }
  }

  // ── Case 2: brand-new signup - create the agency + profile, same shape
  // as the old app/api/auth/signup/route.js did.
  if (!USERNAME_RE.test(username)) {
    console.error(`[clerk webhook] user ${clerkUserId} created with invalid/missing username metadata; skipping profile creation`);
    return;
  }

  const { profileId } = await createProfileAndAgency({
    clerkUserId,
    email,
    firstName,
    lastName,
    username,
    agencyName,
    plan: meta.plan,
  });

  // Set on unsafeMetadata by app/signup when it arrived here via the
  // post-checkout redirect (a plan was already paid for before this
  // account existed). Link it now so entitlement doesn't depend on a
  // second, separately-timed Stripe webhook race.
  if (meta.stripeSessionId) {
    try {
      await linkSubscriptionFromStripeSession({ profileId, stripeSessionId: meta.stripeSessionId });
    } catch (err) {
      // The account was created successfully either way - don't throw
      // here, or Clerk will retry this whole webhook and re-run into the
      // "username already exists" case for an account that's already set up.
      console.error("[clerk webhook] Failed to link subscription:", err.message);
    }
  }
}
