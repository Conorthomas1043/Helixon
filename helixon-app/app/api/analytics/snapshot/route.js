import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { groupTransitions, inRange, jobIdsForClient, loadActivity, loadCandidates, loadPlacements, readAnalyticsFilters } from "@/lib/analytics-data";
import { computeCore, computeDeltas, computeTeam, computeTrends, furthestStageIndex } from "@/lib/analytics-snapshot";

// GET /api/analytics/snapshot - the Analytics page's headline numbers
// (totals, funnel, quality, pipeline, conversion, score calibration, team),
// the same figures for the period before (for "vs previous" changes), and
// analysed/placed/fees over time. Filters: see readAnalyticsFilters.
//
// This used to be worked out in the browser from every candidate, fetched
// 200 at a time one request after another, and the funnel only looked at
// each candidate's current stage - so anyone rejected counted as never
// having been shortlisted or interviewed. Here it uses the stage-change
// history to count how far each candidate actually got.

const COLUMNS = "id, job_id, created_at, stage, processing_status, match_score, recruiter_id, last_activity_at";

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { agencyId } = auth;
  const filters = readAnalyticsFilters(new URL(request.url).searchParams);

  const { jobIds, error: clientError } = await jobIdsForClient(agencyId, filters.clientId);
  if (clientError) return fail(clientError);

  const [current, previous, placements, { data: members, error: membersError }] = await Promise.all([
    loadCandidates(agencyId, filters, COLUMNS, { jobIds }),
    filters.range.previous ? loadCandidates(agencyId, filters, COLUMNS, { jobIds, window: filters.range.previous }) : { data: null },
    // Placements in the window whenever the candidate was added - someone
    // screened in June and placed in September is a September placement.
    loadPlacements(agencyId, filters, { jobIds }),
    supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", agencyId),
  ]);
  const loadError = current.error || previous.error || placements.error || membersError;
  if (loadError) return fail(loadError);

  const candidateIds = [...current.data, ...(previous.data ?? [])].map((c) => c.id);
  const { data: activity, error: activityError } = await loadActivity(candidateIds, { types: ["stage_changed"] });
  if (activityError) return fail(activityError);
  const transitions = groupTransitions(activity);

  const furthest = new Map();
  for (const c of [...current.data, ...(previous.data ?? [])]) furthest.set(c.id, furthestStageIndex(c, transitions.get(c.id)));

  const core = computeCore(current.data, furthest);
  const previousCore = previous.data ? computeCore(previous.data, furthest) : null;

  const people = (members ?? []).map((m) => ({ id: m.clerk_user_id, name: recruiterDisplayName(m) || "Unnamed" }));

  return NextResponse.json({
    ok: true,
    filters: {
      period: filters.period,
      from: filters.range.from?.toISOString() ?? null,
      to: filters.range.to?.toISOString() ?? null,
      previous: filters.range.previous
        ? { from: filters.range.previous.from.toISOString(), to: filters.range.previous.to.toISOString() }
        : null,
    },
    ...core,
    team: computeTeam(current.data, people),
    previous: previousCore ? { totals: previousCore.totals, quality: previousCore.quality, conversion: previousCore.conversion } : null,
    deltas: computeDeltas(core, previousCore),
    placedInPeriod: placements.data.filter((p) => inRange(p.at, filters.range)).length,
    trends: computeTrends(current.data, placements.data, filters.range),
    truncated: Boolean(current.truncated || previous.truncated || placements.truncated),
  });
}

function fail(error) {
  console.error("[analytics/snapshot] Query failed:", error.message);
  return NextResponse.json({ ok: false, error: "Failed to load analytics data." }, { status: 500 });
}
