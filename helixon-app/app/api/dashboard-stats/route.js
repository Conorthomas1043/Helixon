import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";
import { agencyDisplayName } from "@/lib/agency-display";
import { planLabel } from "@/lib/plans";
import { getAgencyPlan } from "@/lib/plan";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";

// GET /api/dashboard-stats - feeds app/dashboard/page.js's fetchDashboardData().
// It only reads `agencyName`, `plan`, `analyses` and `truncated` from this
// response (the jobs/recruiters/stats cards on that page are computed
// client-side from `analyses`), so that's all this returns.
//
// One row per pipeline entry (candidates - one row per person per job, see
// lib/rescreen.js), the same rows Candidates and Analytics count. This used
// to read the scores table, which has no last-activity date (so "stalled"
// could only be worked out from when the CV was analysed) and no row at all
// for an analysis that failed before scoring.
const ROW_BATCH = 1000;
// A limit to stop a runaway loop, not an expected agency size. Past it the
// response says so (`truncated`) and the page tells the user, instead of
// quietly computing every Overview number from part of the data.
const ROW_CAP = 20000;

const COLUMNS =
  "id, full_name, name, processing_status, recruiter_id, stage, next_action, match_score, created_at, last_activity_at, job_id, jobs(title, client)";

async function fetchPipelineRows(agencyId) {
  let all = [];
  let from = 0;
  while (from < ROW_CAP) {
    const { data, error } = await supabase
      .from("candidates")
      .select(COLUMNS)
      .eq("agency_id", agencyId)
      // Analysed rows only: a CSV import or API-created record that was
      // never screened has no score and isn't an analysis.
      .or("match_score.not.is.null,processing_status.neq.completed")
      .order("created_at", { ascending: false })
      .range(from, from + ROW_BATCH - 1);
    if (error) return { data: null, error, truncated: false };
    all = all.concat(data ?? []);
    if (!data || data.length < ROW_BATCH) return { data: all, error: null, truncated: false };
    from += ROW_BATCH;
  }
  return { data: all, error: null, truncated: true };
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
    return NextResponse.json({ agencyName: agencyDisplayName(null, profile), plan: null, analyses: [], truncated: false });
  }

  const [{ data: agency, error: agencyError }, { data: rows, error: rowError, truncated }] = await Promise.all([
    supabase.from("agencies").select("name, plan_name, analyses_used, analyses_limit, settings").eq("id", agencyId).maybeSingle(),
    fetchPipelineRows(agencyId),
  ]);

  if (agencyError || rowError) {
    console.error("[dashboard-stats] Query failed:", (agencyError || rowError).message);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }

  // candidates.recruiter_id is the Clerk user id (see api/run), not a
  // profiles.id - resolve display names in one query instead of one per row.
  const recruiterNames = await resolveRecruiterNames(supabase, (rows ?? []).map((c) => c.recruiter_id));

  const analyses = (rows ?? []).map((c) => ({
    id: c.id,
    candidateId: c.id,
    candidateName: c.full_name || c.name || "Unnamed candidate",
    jobId: c.job_id || null,
    jobTitle: c.jobs?.title || "Unspecified role",
    company: c.jobs?.client || null,
    recruiterId: c.recruiter_id || null,
    recruiterName: recruiterNames.get(c.recruiter_id) || null,
    status: c.processing_status === "processing" || c.processing_status === "failed" ? c.processing_status : "completed",
    stage: c.stage || null,
    score: typeof c.match_score === "number" ? c.match_score : null,
    createdAt: c.created_at,
    lastActivityAt: c.last_activity_at || null,
    nextAction: c.next_action?.label ? c.next_action : null,
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
    truncated,
  });
}
