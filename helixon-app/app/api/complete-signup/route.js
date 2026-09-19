import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { PRICE_IDS } from "@/lib/plans";
import { cleanLine } from "@/lib/sanitize";
import {
  createProfileAndAgency,
  generateUsername,
  linkSubscriptionFromStripeSession,
} from "@/lib/create-profile";

// Used by app/signup when someone lands there already signed in to Clerk
// (the post-checkout redirect from app/checkout/success for a user whose
// profile/agency row doesn't exist yet). They don't need Clerk's <SignUp/>
// again - they just need the agency/profile row that normally gets
// created by app/api/webhooks/clerk on user.created, plus the
// subscription linked to the Stripe session they already paid through.
export async function POST(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const agencyName = cleanLine(body?.agencyName, 100);
    const sessionId = body?.sessionId || null;
    // Client-supplied, so only accept a real plan id - anything else is
    // stored as the default instead of arbitrary text on the agency row.
    const plan = typeof body?.plan === "string" && Object.hasOwn(PRICE_IDS, body.plan) ? body.plan : null;

    // Idempotency: if a profile already exists (e.g. the webhook won the
    // race, or the user double-submits), don't create a second one -
    // just make sure the subscription gets linked and return it.
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();

    if (lookupError) {
      console.error("[complete-signup] Profile lookup failed:", lookupError.message);
      return NextResponse.json({ ok: false, error: "Could not load your account. Please try again." }, { status: 500 });
    }

    let profileId = existingProfile?.id;

    if (!profileId) {
      if (!agencyName) {
        return NextResponse.json({ ok: false, error: "Agency name is required." }, { status: 400 });
      }

      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress || null;
      const firstName = user?.firstName || "";
      const lastName = user?.lastName || "";
      const username = await generateUsername(user?.username || email?.split("@")[0] || firstName);

      const created = await createProfileAndAgency({
        clerkUserId,
        email,
        firstName,
        lastName,
        username,
        agencyName,
        plan,
      });
      profileId = created.profileId;
    }

    if (sessionId) {
      try {
        const user = await currentUser();
        const verifiedEmails = (user?.emailAddresses || [])
          .filter((e) => e.verification?.status === "verified")
          .map((e) => e.emailAddress);

        const result = await linkSubscriptionFromStripeSession({
          profileId,
          stripeSessionId: sessionId,
          clerkUserId,
          verifiedEmails,
        });

        // The account itself exists, but this payment can't be attached to
        // it - say so instead of dropping them into the app with no plan.
        // Deliberately vague about *why*, so this can't be used to probe
        // which email a given session was paid with.
        if (!result.linked && result.reason) {
          const message =
            result.reason === "email_mismatch"
              ? "We couldn't match this payment to your account. Please sign in with the email address you paid with, or contact support and we'll sort it out."
              : "This payment can't be linked to your account. Please contact support and we'll sort it out.";
          return NextResponse.json({ ok: false, error: message }, { status: 409 });
        }
      } catch (err) {
        // Their account exists either way - don't fail the whole request
        // over subscription linking; the Stripe webhook will retry entitlement.
        console.error("[complete-signup] Failed to link subscription:", err.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[complete-signup] Failed:", err.message);
    return NextResponse.json({ ok: false, error: "Could not finish setting up your account. Please try again." }, { status: 500 });
  }
}
