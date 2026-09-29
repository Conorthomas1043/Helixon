import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { PLAN_MONTHLY_GBP, planLabel } from "@/lib/plans";
import { demoExpired } from "@/lib/subscription-status";

// Billing for /admin/billing: every subscription with who it belongs to,
// revenue from paying Stripe subscriptions only (demo access granted from
// the Users page has no Stripe subscription and is counted separately),
// and what changed in the selected range.

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
const PAYING = new Set(["active", "trialing", "past_due"]);

export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const range = RANGE_DAYS[searchParams.get("range")] ? searchParams.get("range") : "30d";
    const since = Date.now() - RANGE_DAYS[range] * 86400e3;

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id,user_id,plan,status,stripe_customer_id,stripe_subscription_id,created_at,updated_at,demo_expires_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) return adminDbError("billing", error);

    const profileIds = [...new Set((subs || []).map((s) => s.user_id).filter(Boolean))];
    const { data: profiles, error: profileError } = profileIds.length
      ? await supabase.from("profiles").select("id,first_name,last_name,username,agency_id").in("id", profileIds)
      : { data: [], error: null };
    if (profileError) return adminDbError("billing", profileError);

    const agencyIds = [...new Set((profiles || []).map((p) => p.agency_id).filter(Boolean))];
    const { data: agencies, error: agencyError } = agencyIds.length
      ? await supabase.from("agencies").select("id,name").in("id", agencyIds)
      : { data: [], error: null };
    if (agencyError) return adminDbError("billing", agencyError);

    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    const agencyById = new Map((agencies || []).map((a) => [a.id, a.name]));

    const rows = (subs || []).map((s) => {
      const profile = profileById.get(s.user_id);
      const demo = !s.stripe_subscription_id;
      const monthly = !demo && PAYING.has(s.status) ? PLAN_MONTHLY_GBP[s.plan] || 0 : 0;
      return {
        id: s.id,
        plan: s.plan,
        planLabel: planLabel(s.plan),
        // Demo access past its end date stops working at once; the daily
        // admin cron marks the row cancelled later.
        status: demo && demoExpired(s) ? "ended" : s.status || "unknown",
        demo,
        demoExpiresAt: demo ? s.demo_expires_at || null : null,
        monthly,
        customer: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "(no profile)",
        agencyId: profile?.agency_id || null,
        agencyName: profile?.agency_id ? agencyById.get(profile.agency_id) || null : null,
        stripeCustomerId: s.stripe_customer_id,
        stripeSubscriptionId: s.stripe_subscription_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      };
    });

    const real = rows.filter((r) => !r.demo);
    const byStatus = {};
    const byPlan = {};
    for (const r of real) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (PAYING.has(r.status)) byPlan[r.planLabel || r.plan || "unknown"] = (byPlan[r.planLabel || r.plan || "unknown"] || 0) + 1;
    }
    const inRange = (iso) => iso && Date.parse(iso) >= since;
    const mrr = real.reduce((sum, r) => sum + r.monthly, 0);

    return json({
      ok: true,
      range,
      since: new Date(since).toISOString(),
      stripeDashboard: String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test") ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com",
      summary: {
        mrr,
        arr: mrr * 12,
        paying: real.filter((r) => PAYING.has(r.status)).length,
        pastDue: real.filter((r) => r.status === "past_due").length,
        demo: rows.filter((r) => r.demo && r.status === "active").length,
        newInRange: real.filter((r) => inRange(r.createdAt)).length,
        cancelledInRange: real.filter((r) => r.status === "canceled" && inRange(r.updatedAt)).length,
        byStatus,
        byPlan,
      },
      subscriptions: rows,
    });
  } catch (error) {
    return adminErrorResponse("billing", error);
  }
}
