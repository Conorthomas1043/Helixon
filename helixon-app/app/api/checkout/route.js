import Stripe from "stripe";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase as supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

// Map your internal plan ids (sent from BuyPlanButton in page.jsx) to
// Stripe Price ids. Create these in the Stripe Dashboard → Products first
// (screenshot step 1 - "Create a product"), then paste the resulting
// price_... ids here. Never hardcode raw amounts here; let Stripe's
// Price object be the single source of truth for what people pay.
const PRICE_IDS = {
  individual: process.env.STRIPE_PRICE_INDIVIDUAL, // £249/mo - matches the "Individual" product in Stripe
  agency:     process.env.STRIPE_PRICE_AGENCY,      // £349/mo - matches the "Agency" product in Stripe (was "team")
};

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const plan = body?.plan;

    if (!plan || !PRICE_IDS[plan]) {
      return NextResponse.json({ ok: false, error: "Unknown plan." }, { status: 400 });
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      // Env var not set - fail with a clear message rather than a raw
      // Stripe 500 further down.
      return NextResponse.json(
        { ok: false, error: "This plan isn't available for checkout right now." },
        { status: 500 }
      );
    }

    // Guest checkout is now the front door: there's no standalone /signup
    // entry point in the nav any more, so a first-time buyer will never
    // have a Clerk session at this point. If someone *is* already logged
    // in (an existing customer upgrading, or someone whose account
    // exists but has no plan yet), resolve their profile so the webhook
    // can attach the subscription straight to their existing row instead
    // of routing them through /signup again.
    const { userId: clerkUserId } = await auth();

    let profile = null;
    let email;

    if (clerkUserId) {
      const user = await currentUser();
      email = user?.primaryEmailAddress?.emailAddress || undefined;

      // subscriptions.user_id is a foreign key onto profiles.id (the
      // pre-existing uuid PK, unrelated to the Clerk id) - resolve that
      // first so the webhook below writes to the same row
      // lib/customer-auth.js reads from.
      const { data, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (profileError) {
        console.error("[checkout] Profile lookup failed:", profileError.message);
        return NextResponse.json({ ok: false, error: "Could not load your account. Please try again." }, { status: 500 });
      }

      profile = data;
    }

    // No profile to attach to yet - either a signed-out visitor buying
    // for the first time (the common case now) or a logged-in Clerk user
    // whose profile row hasn't been created yet. Either way, checkout
    // proceeds with no client_reference_id and this flag -
    // checkout/success reads it and sends them to /signup (with the paid
    // session_id) to create/finish their account instead of straight to
    // the product.
    const needsSignup = !profile;

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    // Step 2 from the Stripe guide - "Create a Checkout Session"
    // (POST /v1/checkout/sessions). The Stripe SDK wraps that call here.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // Only set once we actually have a profile row to match back to -
      // the stripe webhook treats a missing client_reference_id as "can't
      // fulfil yet", which is correct here since there's no profile.
      ...(profile?.id ? { client_reference_id: profile.id } : {}),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
      metadata: {
        plan,
        userId: profile?.id || "",
        clerkUserId: clerkUserId || "",
        needsSignup: needsSignup ? "true" : "false",
      },
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, error: "Could not start checkout. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, redirectTo: session.url });
  } catch (err) {
    console.error("[checkout] Stripe error:", err);
    return NextResponse.json({ ok: false, error: "Checkout is temporarily unavailable. Please try again." }, { status: 500 });
  }
}