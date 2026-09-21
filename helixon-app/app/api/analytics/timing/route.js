import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { STAGE_LABELS, FUNNEL_ORDER } from "@/lib/stage-labels";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";

// Everything the main funnel/quality/conversion numbers in
// getAnalyticsSnapshot() (lib/dashboard-api.js) don't cover: speed
// (time to fill/hire, time in stage, offer acceptance), outreach activity
// counts, source of hire, why candidates get rejected, candidate reuse
// across jobs, self-reported financials, and post-hire retention.
// One endpoint, one pass over the agency's candidates + activity history,
// rather than a route per metric - they all read the same base rows.
//
// Financial figures (fee/cost/margin) and retention are self-reported
// (candidates.placement_fee/placement_cost/retention_30d/retention_90d,
// set from the candidate detail page) - Helixon has no independent way to
// verify any of it, same honesty standard as the score-calibration panel.
//
// Median, not mean, for day-count figures - see the comment this file
// already had on why (a single four-month outlier shouldn't dominate a
// small agency's number).
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function daysBetween(fromIso, toIso) {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000));
}

const SOURCE_LABELS = {
  referral: "Referral",
  job_board: "Job board",
  linkedin: "LinkedIn",
  direct_sourcing: "Direct sourcing",
  agency_database: "Agency database",
  other: "Other",
};

const REJECTION_REASON_LABELS = {
  unrealistic_requirements: "Unrealistic requirements",
  compensation: "Compensation mismatch",
  culture_fit: "Culture fit",
  skills_gap: "Skills gap",
  slow_process: "Process too slow",
  candidate_withdrew: "Candidate withdrew",
  client_declined: "Client declined",
  role_closed: "Role closed",
  other: "Other",
};

const OUTREACH_TYPES = {
  call_logged: "Calls",
  email_logged: "Emails",
  meeting_logged: "Meetings",
  cv_sent_logged: "CVs sent",
};

const EMPTY_RESPONSE = {
  ok: true,
  timeToHireDays: null,
  timeToHireSampleSize: 0,
  timeToFillDays: null,
  timeToFillSampleSize: 0,
  timeInStage: [],
  offerAcceptance: { accepted: 0, declined: 0, pending: 0, rate: null },
  outreach: { total: 0, byType: [], byRecruiter: [] },
  source: [],
  rejectionReasons: [],
  reuse: { totalPeople: 0, reused: 0, rate: null },
  financial: { totalFee: 0, totalCost: 0, margin: null, avgFee: null, placementsWithFee: 0, byRecruiter: [] },
  advertising: [],
  retention: {
    thirtyDay: { retained: 0, left: 0, rate: null },
    ninetyDay: { retained: 0, left: 0, rate: null },
  },
  feedback: {
    candidateNps: { responses: 0, score: null, promoters: 0, passives: 0, detractors: 0 },
    clientSatisfaction: { responses: 0, avgRating: null },
  },
};

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const [
    { data: candidates, error: candError },
    { data: jobs, error: jobError },
    { data: channels, error: channelError },
    { data: feedbackResponses, error: feedbackError },
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, job_id, created_at, stage, email, recruiter_id, source, rejection_reason, placement_fee, placement_cost, retention_30d, retention_90d")
      .eq("agency_id", agencyId),
    supabase.from("jobs").select("id, created_at").eq("agency_id", agencyId),
    supabase.from("job_channels").select("channel, clicks, spend").eq("agency_id", agencyId),
    supabase.from("feedback_requests").select("kind, rating").eq("agency_id", agencyId).not("responded_at", "is", null),
  ]);

  if (candError || jobError || channelError || feedbackError) {
    console.error("[analytics/timing] Query failed:", (candError || jobError || channelError || feedbackError).message);
    return NextResponse.json({ ok: false, error: "Failed to load analytics data." }, { status: 500 });
  }

  const candidateIds = (candidates || []).map((c) => c.id);
  if (candidateIds.length === 0) {
    return NextResponse.json(EMPTY_RESPONSE);
  }

  // Paged the same way app/api/dashboard-stats/route.js pages score rows -
  // an .in() with thousands of ids is its own problem, but agency-scoped
  // activity history stays small enough in practice for one bounded query.
  const { data: activity, error: activityError } = await supabase
    .from("candidate_activity")
    .select("candidate_id, type, meta, created_at")
    .in("candidate_id", candidateIds.slice(0, 5000))
    .order("created_at", { ascending: true });

  if (activityError) {
    console.error("[analytics/timing] Activity query failed:", activityError.message);
    return NextResponse.json({ ok: false, error: "Failed to load analytics data." }, { status: 500 });
  }

  const candidateById = new Map((candidates || []).map((c) => [c.id, c]));
  const jobById = new Map((jobs || []).map((j) => [j.id, j]));

  const recruiterIds = [...new Set((candidates || []).map((c) => c.recruiter_id).filter(Boolean))];
  const recruiterNames = recruiterIds.length ? await resolveRecruiterNames(supabase, recruiterIds) : new Map();
  const recruiterLabel = (id) => (id ? recruiterNames.get(id) || "Unknown recruiter" : "Unassigned");

  // ── Stage-change history: time to fill/hire, time in stage, offers ────
  const transitionsByCandidate = new Map();
  const outreachRows = [];
  for (const row of activity || []) {
    if (row.type === "stage_changed") {
      if (!transitionsByCandidate.has(row.candidate_id)) transitionsByCandidate.set(row.candidate_id, []);
      transitionsByCandidate.get(row.candidate_id).push(row);
    } else if (OUTREACH_TYPES[row.type]) {
      outreachRows.push(row);
    }
  }

  const timeToHireSamples = [];
  const timeToFillByJob = new Map();
  const stageDurations = {};
  FUNNEL_ORDER.forEach((s) => (stageDurations[s] = []));

  let offerReached = 0;
  let offerAccepted = 0;
  let offerDeclined = 0;

  for (const [candidateId, transitions] of transitionsByCandidate) {
    const candidate = candidateById.get(candidateId);
    if (!candidate) continue;

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

  // ── Outreach activity (calls/emails/meetings/CVs sent) ─────────────────
  const outreachByType = {};
  const outreachByRecruiter = new Map();
  for (const row of outreachRows) {
    outreachByType[row.type] = (outreachByType[row.type] || 0) + 1;
    const recruiterId = candidateById.get(row.candidate_id)?.recruiter_id || null;
    const key = recruiterId || "unassigned";
    if (!outreachByRecruiter.has(key)) outreachByRecruiter.set(key, { name: recruiterLabel(recruiterId), count: 0 });
    outreachByRecruiter.get(key).count += 1;
  }

  // ── Source of hire ──────────────────────────────────────────────────────
  const sourceGroups = new Map();
  for (const c of candidates || []) {
    if (!c.source) continue;
    if (!sourceGroups.has(c.source)) sourceGroups.set(c.source, { total: 0, placed: 0 });
    const g = sourceGroups.get(c.source);
    g.total += 1;
    if (c.stage === "Placed") g.placed += 1;
  }
  const source = [...sourceGroups.entries()]
    .map(([key, g]) => ({
      key,
      label: SOURCE_LABELS[key] || key,
      total: g.total,
      placed: g.placed,
      placementRate: g.total ? Math.round((g.placed / g.total) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Advertising/campaign metrics ────────────────────────────────────────
  // Channel spend/clicks (job_channels, logged per job) aggregated agency-
  // wide and matched against applicants-per-source (the sourceGroups totals
  // above) to get apply rate and cost per applicant. "Clicks" here really
  // means "however the recruiter's ad platform defines a click/view" -
  // Helixon doesn't run the ads, so it can't define that more precisely.
  const channelTotals = new Map();
  for (const row of channels || []) {
    if (!channelTotals.has(row.channel)) channelTotals.set(row.channel, { clicks: 0, spend: 0 });
    const t = channelTotals.get(row.channel);
    t.clicks += row.clicks || 0;
    t.spend += Number(row.spend || 0);
  }
  const advertising = [...channelTotals.entries()]
    .map(([key, t]) => {
      const applicants = sourceGroups.get(key)?.total || 0;
      return {
        key,
        label: SOURCE_LABELS[key] || key,
        clicks: t.clicks,
        spend: Math.round(t.spend * 100) / 100,
        applicants,
        applyRate: t.clicks > 0 ? Math.round((applicants / t.clicks) * 1000) / 10 : null,
        costPerApplicant: applicants > 0 && t.spend > 0 ? Math.round((t.spend / applicants) * 100) / 100 : null,
      };
    })
    .filter((row) => row.clicks > 0 || row.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  // ── Why candidates get rejected ─────────────────────────────────────────
  const rejectionGroups = new Map();
  for (const c of candidates || []) {
    if (c.stage !== "Rejected" || !c.rejection_reason) continue;
    rejectionGroups.set(c.rejection_reason, (rejectionGroups.get(c.rejection_reason) || 0) + 1);
  }
  const rejectionReasons = [...rejectionGroups.entries()]
    .map(([key, count]) => ({ key, label: REJECTION_REASON_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count);

  // ── Candidate database reuse rate ───────────────────────────────────────
  // How often the same person (matched on email - the only stable identity
  // candidates.job_id-per-row rows share) was submitted for more than one
  // job. Case-insensitive; candidates with no email can't be matched and
  // are excluded from both the numerator and denominator rather than
  // silently counted as "not reused".
  const byEmail = new Map();
  for (const c of candidates || []) {
    const email = c.email?.trim().toLowerCase();
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, new Set());
    if (c.job_id) byEmail.get(email).add(c.job_id);
  }
  const withEmail = [...byEmail.values()].filter((jobSet) => jobSet.size > 0);
  const reusedCount = withEmail.filter((jobSet) => jobSet.size > 1).length;

  // ── Financial (self-reported) ───────────────────────────────────────────
  const placedWithFee = (candidates || []).filter((c) => c.stage === "Placed" && c.placement_fee != null);
  const totalFee = placedWithFee.reduce((sum, c) => sum + Number(c.placement_fee || 0), 0);
  const totalCost = (candidates || [])
    .filter((c) => c.stage === "Placed" && c.placement_cost != null)
    .reduce((sum, c) => sum + Number(c.placement_cost || 0), 0);
  // Margin only from placements with BOTH a fee and a cost entered - fee
  // income minus cost from two different, possibly non-overlapping subsets
  // would understate or overstate margin depending on which placements
  // happen to have which field filled in.
  const placedWithBoth = (candidates || []).filter(
    (c) => c.stage === "Placed" && c.placement_fee != null && c.placement_cost != null,
  );
  const matchedFee = placedWithBoth.reduce((sum, c) => sum + Number(c.placement_fee || 0), 0);
  const matchedCost = placedWithBoth.reduce((sum, c) => sum + Number(c.placement_cost || 0), 0);

  const feeByRecruiter = new Map();
  for (const c of placedWithFee) {
    const key = c.recruiter_id || "unassigned";
    if (!feeByRecruiter.has(key)) feeByRecruiter.set(key, { name: recruiterLabel(c.recruiter_id), total: 0, placements: 0 });
    const g = feeByRecruiter.get(key);
    g.total += Number(c.placement_fee || 0);
    g.placements += 1;
  }

  // ── Retention (self-reported check-ins) ─────────────────────────────────
  function retentionSummary(field) {
    let retained = 0;
    let left = 0;
    for (const c of candidates || []) {
      if (c[field] === "retained") retained += 1;
      else if (c[field] === "left") left += 1;
    }
    const resolved = retained + left;
    return { retained, left, rate: resolved > 0 ? Math.round((retained / resolved) * 100) : null };
  }

  // ── Candidate NPS + client/hiring-manager satisfaction ──────────────────
  // Standard NPS: promoters (9-10) minus detractors (0-6), as a percentage
  // of all responses - passives (7-8) count toward the total but not the
  // score itself, same as any standard NPS calculation.
  const npsResponses = (feedbackResponses || []).filter((r) => r.kind === "candidate_nps" && r.rating !== null);
  const promoters = npsResponses.filter((r) => r.rating >= 9).length;
  const detractors = npsResponses.filter((r) => r.rating <= 6).length;
  const passives = npsResponses.length - promoters - detractors;

  const clientResponses = (feedbackResponses || []).filter((r) => r.kind === "client_feedback" && r.rating !== null);
  const avgClientRating = clientResponses.length
    ? Math.round((clientResponses.reduce((sum, r) => sum + r.rating, 0) / clientResponses.length) * 10) / 10
    : null;

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
    outreach: {
      total: outreachRows.length,
      byType: Object.entries(OUTREACH_TYPES).map(([key, label]) => ({ key, label, count: outreachByType[key] || 0 })),
      byRecruiter: [...outreachByRecruiter.values()].sort((a, b) => b.count - a.count),
    },
    source,
    advertising,
    rejectionReasons,
    reuse: {
      totalPeople: withEmail.length,
      reused: reusedCount,
      rate: withEmail.length ? Math.round((reusedCount / withEmail.length) * 100) : null,
    },
    financial: {
      totalFee: Math.round(totalFee * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      margin: placedWithBoth.length > 0 ? Math.round((matchedFee - matchedCost) * 100) / 100 : null,
      avgFee: placedWithFee.length ? Math.round((totalFee / placedWithFee.length) * 100) / 100 : null,
      placementsWithFee: placedWithFee.length,
      byRecruiter: [...feeByRecruiter.values()].sort((a, b) => b.total - a.total),
    },
    retention: {
      thirtyDay: retentionSummary("retention_30d"),
      ninetyDay: retentionSummary("retention_90d"),
    },
    feedback: {
      candidateNps: {
        responses: npsResponses.length,
        score: npsResponses.length ? Math.round(((promoters - detractors) / npsResponses.length) * 100) : null,
        promoters,
        passives,
        detractors,
      },
      clientSatisfaction: {
        responses: clientResponses.length,
        avgRating: avgClientRating,
      },
    },
  });
}
