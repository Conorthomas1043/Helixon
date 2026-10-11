import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { getAgencyPlan } from "@/lib/plan";
import { reportError } from "@/lib/report-error";
import { billingSummary, emptyBillingSummary } from "@/lib/billing-summary";

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
    return NextResponse.json(emptyBillingSummary());
  }

  const [{ data: agency, error: agencyError }, { data: subscription, error: subError }] = await Promise.all([
    supabaseAdmin.from("agencies").select("name, plan_name, analyses_used, settings").eq("id", agencyId).maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("plan, status, stripe_customer_id, updated_at")
      .eq("user_id", profile?.id)
      .maybeSingle(),
  ]);

  if (agencyError || subError) {
    reportError("[billing] Lookup failed:", (agencyError || subError).message);
    return NextResponse.json({ ok: false, error: "Could not load billing details. Please try again." }, { status: 500 });
  }

  return NextResponse.json(billingSummary({ agency, subscription, agencyPlan: await getAgencyPlan(agencyId) }));
}
