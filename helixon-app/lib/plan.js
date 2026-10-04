import "server-only";
import { supabase } from "@/lib/supabase";
import { ACCESS_STATUSES, grantsAccess } from "@/lib/subscription-status";

// The single reliable source for "what plan is this agency actually on
// right now". agencies.settings.plan and agencies.plan_name are both
// written once at signup (see lib/create-profile.js) and never touched
// again - a self-service upgrade/downgrade through the Stripe Billing
// Portal only ever updates subscriptions.plan (see
// app/api/webhooks/stripe), so the two agency-table fields silently go
// stale the moment a customer changes plan. Several routes previously
// read `agency.plan_name || agency.settings?.plan || subscription?.plan`,
// i.e. preferred the two stale fields over the one accurate one.
//
// subscriptions.user_id is a uuid FK to profiles.id belonging to whoever
// actually paid (the agency owner) - an invited teammate's own profile
// has no subscription row of their own. Looking this up against every
// profile sharing the given agency_id, rather than one specific user's
// profile, means every member of the agency resolves to the same answer
// regardless of who's asking - see lib/clerk-org.js's ensureAgencyOrg for
// the same reasoning applied to org creation.
export async function getAgencyPlan(agencyId) {
  if (!agencyId) return null;

  const { data: agencyProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("agency_id", agencyId);
  if (profilesError) throw new Error(profilesError.message);

  const profileIds = (agencyProfiles || []).map((p) => p.id);
  if (profileIds.length === 0) return null;

  // Not maybeSingle(): an agency can briefly have two active rows (a
  // re-subscribe, or a second member's own subscription), and
  // maybeSingle() errors on more than one row - which threw here and took
  // the Team page's invite panel down with a 500. An Agency-plan row wins.
  const query = (columns) => supabase.from("subscriptions").select(columns).in("user_id", profileIds).in("status", [...ACCESS_STATUSES]);
  let { data: subscriptions, error: subError } = await query("plan,status,stripe_subscription_id,demo_expires_at");
  // demo_expires_at arrives with migration 20260929030200.
  if (subError?.code === "42703") ({ data: subscriptions, error: subError } = await query("plan,status"));
  if (subError) throw new Error(subError.message);

  // Demo access that has reached its end date no longer grants a plan.
  const plans = (subscriptions || []).filter((s) => grantsAccess(s)).map((s) => s.plan).filter(Boolean);
  return plans.includes("agency") ? "agency" : plans[0] || null;
}
