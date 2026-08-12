// app/api/checkout/route.js
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICE_IDS = {
  solo: process.env.STRIPE_PRICE_SOLO,
  team: process.env.STRIPE_PRICE_TEAM,
};

export async function POST(req) {
  try {
    const body = await req.json();
    const plan = body?.plan;

    if (!plan || !PLAN_PRICE_IDS[plan]) {
      return NextResponse.json({ ok: false, error: "Invalid plan." }, { status: 400 });
    }

    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) {
      console.error(`[checkout] Missing Stripe price id for plan "${plan}" — check STRIPE_PRICE_SOLO / STRIPE_PRICE_TEAM env vars.`);
      return NextResponse.json({ ok: false, error: "This plan isn't available yet." }, { status: 500 });
    }

    // ── Identify the logged-in user, if any, via Supabase SSR client ──────
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // Not logged in — send them to sign up first, with the chosen plan
    // preserved so they land back here (or straight to Stripe) after.
    if (!user) {
      return NextResponse.json({
        ok: true,
        redirectTo: `/signup-agency?plan=${plan}`,
      });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { plan, user_id: user.id },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/#pricing?checkout=cancelled`,
    });

    return NextResponse.json({ ok: true, redirectTo: session.url });
  } catch (err) {
    console.error("[checkout] Error:", err.message);
    return NextResponse.json({ ok: false, error: "Something went wrong starting checkout." }, { status: 500 });
  }
}