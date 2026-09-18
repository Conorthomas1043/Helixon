import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { getAgencyPlan } from "@/lib/plan";

// GET /api/billing - the data behind app/billing. Reuses the same
// getCustomerContext() helper api/run and api/dashboard-stats already use,
// and the same agencies/subscriptions tables checkout and the webhook
// already read and write.
export async function GET() {
  const { user, agencyId, profile } = await getCustomerContext();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in to view billing." }, { status: 401 });
  }
  if (!agencyId) {
    return NextResponse.json({ ok: true, agencyName: null, plan: null, subscription: null });
  }

  const [{ data: agency, error: agencyError }, { data: subscription, error: subError }] = await Promise.all([
    supabaseAdmin.from("agencies").select("name, plan_name, analyses_used, analyses_limit, settings").eq("id", agencyId).maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("plan, status, stripe_customer_id, stripe_subscription_id, updated_at")
      .eq("user_id", profile?.id)
      .maybeSingle(),
  ]);

  if (agencyError || subError) {
    console.error("[billing] Lookup failed:", (agencyError || subError).message);
    return NextResponse.json({ ok: false, error: "Could not load billing details. Please try again." }, { status: 500 });
  }

  // The `subscription` fetched above is scoped to *this* signed-in user's
  // own profile.id, which is correct for the Stripe-management fields
  // below (only the paying owner has a stripe_customer_id to manage) but
  // wrong for the plan *label* - an invited teammate viewing this page has
  // no subscription row of their own and would otherwise fall through to
  // agencies.plan_name/settings.plan, which go stale the moment the owner
  // changes plan via the Stripe Billing Portal (see app/api/webhooks/stripe).
  // getAgencyPlan resolves the same, currently-accurate answer regardless
  // of which team member is asking.
  const plan = (await getAgencyPlan(agencyId)) || agency?.plan_name || agency?.settings?.plan || null;
  const analysesUsed = agency?.analyses_used ?? agency?.settings?.analyses_used ?? null;

  return NextResponse.json({
    ok: true,
    agencyName: agency?.name || null,
    plan,
    analysesUsed,
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          updatedAt: subscription.updated_at,
          hasStripeCustomer: Boolean(subscription.stripe_customer_id),
        }
      : null,
  });
}
