import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";
import { agencyDisplayName } from "@/lib/agency-display";

// GET /api/dashboard-stats - feeds app/dashboard/page.js's fetchDashboardData().
// It only reads `agencyName`, `plan`, and `analyses` from this response (the
// jobs/recruiters/stats cards on that page are computed client-side from
// `analyses`), so that's all this returns.
//
// Rebuilt against the real, currently-written-to schema (candidates/jobs/
// scores from app/api/run.js, scoped by agency_id) and the same Clerk +
// Supabase auth pattern api/run and api/checkout already use - the
// previous version queried a `recruiters` table and a Supabase-Auth
// bearer-token session that nothing else in the app uses anymore.
export async function GET() {
  const { user, agencyId, profile } = await getCustomerContext();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  if (!agencyId) {
    // Same "logged in, no agency yet" case api/checkout and api/billing
    // handle - nothing to show yet, not an error. Still try the person's
    // own name before the generic placeholder.
    return NextResponse.json({ agencyName: agencyDisplayName(null, profile), plan: null, analyses: [] });
  }

  const [{ data: agency, error: agencyError }, { data: scoreRows, error: scoreError }] = await Promise.all([
    supabase.from("agencies").select("name, plan_name, analyses_used, analyses_limit, settings").eq("id", agencyId).maybeSingle(),
    supabase
      .from("scores")
      .select(
        "id, match_score, stage, created_at, candidates(id, full_name, name, processing_status, recruiter_id), jobs(title, client)"
      )
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (agencyError || scoreError) {
    console.error("[dashboard-stats] Query failed:", (agencyError || scoreError).message);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }

  // candidates.recruiter_id is the Clerk user id (see api/run), not a
  // profiles.id - resolve display names for whichever recruiters show up
  // in this batch of scores in one extra query instead of one per row.
  const recruiterClerkIds = [...new Set((scoreRows ?? []).map((s) => s.candidates?.recruiter_id).filter(Boolean))];
  let recruiterNames = new Map();
  if (recruiterClerkIds.length > 0) {
    const { data: recruiterProfiles } = await supabase
      .from("profiles")
      .select("clerk_user_id, first_name, last_name")
      .in("clerk_user_id", recruiterClerkIds);
    recruiterNames = new Map(
      (recruiterProfiles ?? []).map((p) => [p.clerk_user_id, [p.first_name, p.last_name].filter(Boolean).join(" ") || null])
    );
  }

  const analyses = (scoreRows ?? []).map((s) => ({
    id: s.id,
    candidateName: s.candidates?.full_name || s.candidates?.name || "Unnamed candidate",
    jobTitle: s.jobs?.title || "Unspecified role",
    company: s.jobs?.client || null,
    recruiterName: recruiterNames.get(s.candidates?.recruiter_id) || null,
    status: s.candidates?.processing_status === "completed" ? "completed" : (s.candidates?.processing_status || "completed"),
    stage: s.stage || null,
    score: typeof s.match_score === "number" ? s.match_score : null,
    createdAt: s.created_at,
  }));

  // agencies.plan_name/analyses_used/analyses_limit vs agencies.settings
  // {plan, analyses_used} - this codebase has both conventions in
  // different places (see app/api/employee/ops vs app/api/webhooks/clerk).
  // Read whichever is actually populated rather than assuming one.
  const planName = agency?.plan_name || agency?.settings?.plan || null;
  const analysesUsed = agency?.analyses_used ?? agency?.settings?.analyses_used ?? null;
  const analysesLimit = agency?.analyses_limit ?? agency?.settings?.analyses_limit ?? null;

  return NextResponse.json({
    agencyName: agencyDisplayName(agency, profile),
    plan: planName ? { name: planName, analysesUsed, analysesLimit } : null,
    analyses,
  });
}