import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase as supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

// POST /api/billing/portal - hands the user off to Stripe's hosted Billing
// Portal (invoices, payment method, cancel/change plan) instead of
// re-building that UI here. Requires a Stripe customer, which only exists
// once they've completed checkout at least once.
export async function POST(request) {
  const { user, profile } = await getCustomerContext();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in to manage billing." }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Finish setting up your account first." }, { status: 403 });
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (subError) {
    console.error("[billing/portal] Subscription lookup failed:", subError.message);
    return NextResponse.json({ ok: false, error: "Could not load billing details. Please try again." }, { status: 500 });
  }
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ ok: false, error: "No billing account yet - subscribe to a plan first." }, { status: 404 });
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return NextResponse.json({ ok: true, redirectTo: session.url });
  } catch (err) {
    console.error("[billing/portal] Stripe error:", err);
    return NextResponse.json({ ok: false, error: "Could not open billing portal. Please try again." }, { status: 500 });
  }
}
