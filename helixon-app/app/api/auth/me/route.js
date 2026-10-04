import { NextResponse } from "next/server";
import { PAYMENT_ISSUE_STATUSES } from "@/lib/subscription-status";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { getAgencyPlan } from "@/lib/plan";
import { reportError } from "@/lib/report-error";

// Returns the currently signed-in user (email + first name from `profiles`),
// or 401 if there's no valid session. Used by the dashboard
// to personalize the header/account menu and to drive the one-time
// "Welcome back" banner after login.
//
// This used to also return `isAdmin` from a lookup of the `admins` table by
// Clerk user id - but that column holds old Supabase auth uuids, so it never
// matched anyone, and nothing read the flag. Admin access is the separate
// credential login in lib/admin-auth.js.
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || null;

  let firstName = null;
  let agencyName = null;
  let plan = null;
  // Whether this signed-in account has a Helixon profile linked to an agency.
  // Signing in with Clerk doesn't create one by itself - that happens when the
  // account is created through checkout/signup (Clerk webhook or
  // /api/complete-signup). Without it every agency-scoped API answers 403, so
  // the dashboard uses this flag to explain that instead of failing.
  let hasAgency = false;
  // The caller's own agency id - lets analytics group events by account
  // (the customer is the agency, not the individual recruiter).
  let agencyId = null;
  // A failed renewal on the agency's subscription: { status, isPayer }.
  // Drives the payment banner on every signed-in page - while Stripe
  // retries (past_due) access continues, so without it nobody would know.
  let paymentIssue = null;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, agency_id")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    firstName = profile?.first_name || user?.firstName || null;

    hasAgency = Boolean(profile?.agency_id);
    agencyId = profile?.agency_id || null;

    if (profile?.agency_id) {
      const [{ data: agency }, resolvedPlan] = await Promise.all([
        supabaseAdmin.from("agencies").select("name").eq("id", profile.agency_id).maybeSingle(),
        getAgencyPlan(profile.agency_id),
      ]);
      agencyName = agency?.name || null;
      plan = resolvedPlan;
      paymentIssue = await findPaymentIssue(profile.agency_id, profile.id);
    }
  } catch (e) {
    reportError("[auth/me] Profile lookup failed (non-fatal):", e.message);
    // Unknown, not "no": don't tell the dashboard to show a setup screen just
    // because a lookup failed.
    hasAgency = null;
  }

  return NextResponse.json({
    ok: true,
    user: { id: userId, email, firstName, agencyName, agencyId, plan, hasAgency, paymentIssue },
  });
}

// The agency's subscription rows that need a new payment method. Only the
// member who pays (owns the row) can fix it in Billing; everyone else is
// told who to ask. Errors are non-fatal - no banner rather than a broken page.
async function findPaymentIssue(agencyId, profileId) {
  try {
    const { data: members } = await supabaseAdmin.from("profiles").select("id").eq("agency_id", agencyId);
    const ids = (members || []).map((m) => m.id);
    if (!ids.length) return null;
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, status")
      .in("user_id", ids)
      .in("status", [...PAYMENT_ISSUE_STATUSES])
      .limit(5);
    const row = (subs || [])[0];
    if (!row) return null;
    return { status: row.status, isPayer: (subs || []).some((s) => s.user_id === profileId) };
  } catch (e) {
    reportError("[auth/me] Payment status lookup failed (non-fatal):", e.message);
    return null;
  }
}
