import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { createProfileAndAgency, linkSubscriptionFromStripeSession, generateUsername } from "@/lib/create-profile";
import { AGENCY_SEAT_LIMIT, getOrgSeatUsage, revokeAgencyOrgInvitation } from "@/lib/clerk-org";

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
// Subscribe to: user.created (required), user.deleted (optional, see below),
// organizationMembership.created, organizationMembership.deleted and
// organizationInvitation.created (required for Agency-plan team invites
// and offboarding - see lib/clerk-org.js).
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
    } else if (event.type === "organizationMembership.created") {
      await handleOrganizationMembershipCreated(event.data);
    } else if (event.type === "organizationMembership.deleted") {
      await handleOrganizationMembershipDeleted(event.data);
    } else if (event.type === "organizationInvitation.created") {
      await handleOrganizationInvitationCreated(event.data);
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

  // ── Case 0: signed up by accepting an Agency-plan team invite (see
  // app/signup's ticket branch, which sets this on unsafeMetadata instead
  // of the normal agencyName/plan/stripeSessionId trio). This user is
  // joining an existing agency, not paying for a new one - creating a
  // profile/agency here would both duplicate-create an agency for them
  // AND race the organizationMembership.created handler below, which is
  // what actually knows which agency they're joining (via clerk_org_id).
  // That handler creates their profile instead once the membership event
  // arrives, which Clerk fires immediately after this one.
  if (meta.viaOrgInvite) {
    return;
  }

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
      const verifiedEmails = (clerkUser.email_addresses || [])
        .filter((e) => e.verification?.status === "verified")
        .map((e) => e.email_address);

      const linkResult = await linkSubscriptionFromStripeSession({
        profileId,
        stripeSessionId: meta.stripeSessionId,
        clerkUserId,
        verifiedEmails,
      });
      if (!linkResult.linked && linkResult.reason) {
        // Not thrown: the account was created fine, and retrying this
        // webhook wouldn't change the outcome. app/api/complete-signup will
        // tell the user if they hit this on the signed-in path.
        console.warn(`[clerk webhook] Not linking session ${meta.stripeSessionId} to user ${clerkUserId}: ${linkResult.reason}`);
      }
    } catch (err) {
      // The account was created successfully either way - don't throw
      // here, or Clerk will retry this whole webhook and re-run into the
      // "username already exists" case for an account that's already set up.
      console.error("[clerk webhook] Failed to link subscription:", err.message);
    }
  }
}

// Fires whenever someone joins a Clerk Organization - both for the agency
// owner (Clerk auto-creates their membership the moment
// lib/clerk-org.js's ensureAgencyOrg calls createOrganization with
// createdBy: ownerClerkUserId) and for an invited teammate accepting their
// invite. The owner already has a profile from their original signup, so
// this is a no-op for them; for an invited teammate, this is the only
// place that creates their profiles row, against the *existing* agency
// linked to this org - see the viaOrgInvite branch in handleUserCreated
// above for why it isn't created there instead.
async function handleOrganizationMembershipCreated(membership) {
  const clerkUserId = membership.public_user_data?.user_id;
  const orgId = membership.organization?.id;
  if (!clerkUserId || !orgId) {
    console.error("[clerk webhook] organizationMembership.created missing user_id or organization.id");
    return;
  }

  const { data: existingProfile, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existingProfile) return;

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle();
  if (agencyError) throw new Error(agencyError.message);
  if (!agency) {
    console.error(`[clerk webhook] organizationMembership.created for org ${orgId}, but no agency has that clerk_org_id`);
    return;
  }

  const firstName = (membership.public_user_data?.first_name || "").trim();
  const lastName = (membership.public_user_data?.last_name || "").trim();
  const identifier = membership.public_user_data?.identifier || "";
  const usernameSeed = identifier.split("@")[0] || firstName || "teammate";
  const username = await generateUsername(usernameSeed);

  const { error: insertError } = await supabase.from("profiles").insert({
    id: crypto.randomUUID(), // `profiles.id` has no DB default - every insert must supply one
    clerk_user_id: clerkUserId,
    first_name: firstName || null,
    last_name: lastName || null,
    username,
    agency_id: agency.id,
  });
  if (insertError) throw new Error(insertError.message);
}

// Fires when a member leaves or is removed from a Clerk Organization -
// primarily the backstop for app/api/team/invite's DELETE handler (which
// already clears profiles.agency_id synchronously when removal happens
// through this app), but this is what actually detaches someone if a
// removal happens some other way (directly via Clerk's own dashboard/API,
// bypassing this app's route entirely) - same reasoning as
// handleOrganizationInvitationCreated's backstop below. Without this, a
// member removed outside the app would keep full dashboard access to the
// agency's candidates and jobs indefinitely.
//
// Deliberately does not touch clerk_user_id (unlike user.deleted's
// handler above) - the person's account still exists, they've just left
// this one agency, so keeping the account link is correct.
async function handleOrganizationMembershipDeleted(membership) {
  const clerkUserId = membership.public_user_data?.user_id;
  const orgId = membership.organization?.id;
  if (!clerkUserId || !orgId) {
    console.error("[clerk webhook] organizationMembership.deleted missing user_id or organization.id");
    return;
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle();
  if (agencyError) throw new Error(agencyError.message);
  if (!agency) return; // org isn't linked to any agency - nothing to detach

  // Only clear agency_id if it still points at the agency they were just
  // removed from - guards against stomping on a more recent state if this
  // event happens to arrive out of order after the person joined somewhere
  // else (Clerk webhooks aren't guaranteed to be delivered in order).
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ agency_id: null })
    .eq("clerk_user_id", clerkUserId)
    .eq("agency_id", agency.id);
  if (updateError) throw new Error(updateError.message);
}

// Backstop against the 5-seat cap already enforced when an invite is sent
// via app/api/team/invite's POST handler. Only matters if an invitation
// was created some other way - directly through Clerk's own dashboard or
// API, bypassing this app's route entirely. If accepting this invitation
// would already put the org over AGENCY_SEAT_LIMIT by the time this
// fires, revoke it rather than leave an over-limit invite pending.
async function handleOrganizationInvitationCreated(invitation) {
  const orgId = invitation.organization_id || invitation.organization?.id;
  const invitationId = invitation.id;
  if (!orgId || !invitationId) return;

  const usage = await getOrgSeatUsage(orgId);
  if (usage.used > AGENCY_SEAT_LIMIT) {
    await revokeAgencyOrgInvitation({ orgId, invitationId, requestingUserId: invitation.inviter_user_id });
  }
}
