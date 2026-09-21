import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";
import { agencyDisplayName } from "@/lib/agency-display";
import { planLabel } from "@/lib/plans";
import { getAgencyPlan } from "@/lib/plan";

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
const SCORE_ROW_BATCH = 1000;
// Same 5,000-row sanity cap getAllCandidates() (lib/dashboard-api.js) uses
// for the identical problem - a limit to stop a runaway loop, not an
// expected agency size.
const SCORE_ROW_CAP = 5000;

// The old `.limit(200)` silently computed every Overview metric (attention
// items, top candidates, stage counts, KPIs) from at most the 200 most
// recent scores, with nothing telling an agency past that size their
// numbers were missing data. computeCandidateStats needs real per-row
// detail (not just counts), so this pages through every row instead of
// switching to SQL aggregates - same trade-off getAllCandidates() made for
// Candidates/Analytics.
async function fetchAllScoreRows(agencyId) {
  let all = [];
  let from = 0;
  while (from < SCORE_ROW_CAP) {
    const { data, error } = await supabase
      .from("scores")
      .select(
        "id, match_score, created_at, candidates(id, full_name, name, processing_status, recruiter_id, stage), jobs(title, client)"
      )
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .range(from, from + SCORE_ROW_BATCH - 1);
    if (error) return { data: null, error };
    all = all.concat(data ?? []);
    if (!data || data.length < SCORE_ROW_BATCH) break;
    from += SCORE_ROW_BATCH;
  }
  return { data: all, error: null };
}

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
    fetchAllScoreRows(agencyId),
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
    // The live, current pipeline position - candidates.stage, not scores.stage.
    // scores is an immutable per-analysis history row (its stage is always
    // "new", frozen at analysis time - see api/run's insert), so reading it
    // here would show every past analysis as permanently stuck on "new"
    // regardless of where the recruiter has actually since moved the
    // candidate (Shortlisted, Interview, Placed, ...).
    stage: s.candidates?.stage || null,
    score: typeof s.match_score === "number" ? s.match_score : null,
    createdAt: s.created_at,
  }));

  // getAgencyPlan (subscriptions.plan) is the only source kept in sync on
  // a self-service upgrade/downgrade - agencies.plan_name/settings.plan
  // are written once at signup and never touched again, so they're only
  // used as a last-resort fallback for an agency with no subscription row
  // at all (e.g. a pre-Stripe seed/test account).
  const planName = (await getAgencyPlan(agencyId)) || agency?.plan_name || agency?.settings?.plan || null;
  const analysesUsed = agency?.analyses_used ?? agency?.settings?.analyses_used ?? null;
  const analysesLimit = agency?.analyses_limit ?? agency?.settings?.analyses_limit ?? null;

  return NextResponse.json({
    agencyName: agencyDisplayName(agency, profile),
    plan: planName ? { name: planLabel(planName), analysesUsed, analysesLimit } : null,
    analyses,
  });
}