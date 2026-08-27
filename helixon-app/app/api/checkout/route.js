import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
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

    // Require a logged-in user so we know who to attach the subscription
    // to. Adjust this block if you want to allow checkout before signup -
    // in that case, collect email in the Checkout Session itself instead.
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* no-op: this route doesn't need to write auth cookies */ },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Please sign in before upgrading your plan." },
        { status: 401 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    // Step 2 from the Stripe guide - "Create a Checkout Session"
    // (POST /v1/checkout/sessions). The Stripe SDK wraps that call here.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id, // lets the webhook match back to this user
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
      metadata: { plan, userId: user.id },
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