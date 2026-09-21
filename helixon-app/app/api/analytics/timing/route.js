import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { STAGE_LABELS, FUNNEL_ORDER } from "@/lib/stage-labels";

// Speed/efficiency metrics the Analytics page didn't have: time to fill,
// time to hire, time actually spent in each stage, and the offer ->
// accepted conversion specifically (as opposed to the cumulative "% of
// all candidates who ever reached Offer" already shown elsewhere).
//
// All of it is derived from data the app already writes and had never
// aggregated: app/api/candidates/[id]/stage's PATCH handler logs every
// stage transition to candidate_activity (type "stage_changed", meta
// {from, to}) via lib/candidate-activity.js. Nothing new to capture -
// this just reads what was already there.
//
// Median, not mean, for the day-count figures - a single candidate who
// sat in a stage for four months (on holiday, ghosted, whatever) would
// otherwise dominate a small agency's average and make the number
// useless. Standard practice for "time to fill" reporting in the
// industry is median for the same reason.
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function daysBetween(fromIso, toIso) {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000));
}

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const [{ data: candidates, error: candError }, { data: jobs, error: jobError }] = await Promise.all([
    supabase.from("candidates").select("id, job_id, created_at, stage").eq("agency_id", agencyId),
    supabase.from("jobs").select("id, created_at").eq("agency_id", agencyId),
  ]);

  if (candError || jobError) {
    console.error("[analytics/timing] Query failed:", (candError || jobError).message);
    return NextResponse.json({ ok: false, error: "Failed to load timing data." }, { status: 500 });
  }

  const candidateIds = (candidates || []).map((c) => c.id);
  if (candidateIds.length === 0) {
    return NextResponse.json({
      ok: true,
      timeToHireDays: null,
      timeToFillDays: null,
      timeInStage: [],
      offerAcceptance: { accepted: 0, declined: 0, pending: 0, rate: null },
    });
  }

  // Paged the same way app/api/dashboard-stats/route.js pages score rows -
  // an .in() with thousands of ids is its own problem, but agency-scoped
  // activity history stays small enough in practice that a single
  // bounded-size query is fine here.
  const { data: activity, error: activityError } = await supabase
    .from("candidate_activity")
    .select("candidate_id, meta, created_at")
    .eq("type", "stage_changed")
    .in("candidate_id", candidateIds.slice(0, 5000))
    .order("created_at", { ascending: true });

  if (activityError) {
    console.error("[analytics/timing] Activity query failed:", activityError.message);
    return NextResponse.json({ ok: false, error: "Failed to load timing data." }, { status: 500 });
  }

  const candidateById = new Map((candidates || []).map((c) => [c.id, c]));
  const jobById = new Map((jobs || []).map((j) => [j.id, j]));

  // Ordered transitions per candidate - lets us reconstruct both "when did
  // they first reach X" and "how long were they in each stage between
  // transitions" from one pass.
  const transitionsByCandidate = new Map();
  for (const row of activity || []) {
    if (!transitionsByCandidate.has(row.candidate_id)) transitionsByCandidate.set(row.candidate_id, []);
    transitionsByCandidate.get(row.candidate_id).push(row);
  }

  const timeToHireSamples = [];
  const timeToFillByJob = new Map(); // jobId -> earliest Placed timestamp
  const stageDurations = {}; // stage -> array of day counts spent in it
  FUNNEL_ORDER.forEach((s) => (stageDurations[s] = []));

  let offerReached = 0;
  let offerAccepted = 0;
  let offerDeclined = 0;

  for (const [candidateId, transitions] of transitionsByCandidate) {
    const candidate = candidateById.get(candidateId);
    if (!candidate) continue;

    // Time spent in each stage: walk transitions in order, attributing the
    // gap since the previous milestone (or since the candidate entered the
    // pipeline, for the first one) to the stage they were leaving.
    let stageStart = candidate.created_at;
    let currentStage = "Screened"; // every candidate starts here (app/api/run's insert)
    for (const t of transitions) {
      const to = t.meta?.to;
      if (currentStage && FUNNEL_ORDER.includes(currentStage)) {
        stageDurations[currentStage].push(daysBetween(stageStart, t.created_at));
      }
      stageStart = t.created_at;
      currentStage = to;

      if (to === "Placed") {
        timeToHireSamples.push(daysBetween(candidate.created_at, t.created_at));
        if (candidate.job_id && !timeToFillByJob.has(candidate.job_id)) {
          timeToFillByJob.set(candidate.job_id, t.created_at);
        }
      }
    }

    const reachedOffer = transitions.some((t) => t.meta?.to === "Offer");
    if (reachedOffer) {
      offerReached += 1;
      if (candidate.stage === "Placed") offerAccepted += 1;
      else if (candidate.stage === "Rejected") offerDeclined += 1;
    }
  }

  const timeToFillSamples = [...timeToFillByJob.entries()]
    .map(([jobId, placedAt]) => {
      const job = jobById.get(jobId);
      return job ? daysBetween(job.created_at, placedAt) : null;
    })
    .filter((d) => d !== null);

  const timeInStage = FUNNEL_ORDER.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    medianDays: median(stageDurations[key]),
    count: stageDurations[key].length,
  }));

  const resolvedOffers = offerAccepted + offerDeclined;

  return NextResponse.json({
    ok: true,
    timeToHireDays: median(timeToHireSamples),
    timeToHireSampleSize: timeToHireSamples.length,
    timeToFillDays: median(timeToFillSamples),
    timeToFillSampleSize: timeToFillSamples.length,
    timeInStage,
    offerAcceptance: {
      accepted: offerAccepted,
      declined: offerDeclined,
      pending: offerReached - resolvedOffers,
      rate: resolvedOffers > 0 ? Math.round((offerAccepted / resolvedOffers) * 100) : null,
    },
  });
}
