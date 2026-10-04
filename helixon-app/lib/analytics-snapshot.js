// The Analytics page's headline numbers, worked out server-side
// (app/api/analytics/snapshot) from the agency's pipeline rows and their
// stage-change history. Pure functions so the maths is testable on its own.
//
// Candidate rows (one per person per job):
//   { id, job_id, created_at, stage, processing_status, match_score,
//     recruiter_id, last_activity_at, placement_fee }
// Transitions: stage_changed activity rows, oldest first, per candidate:
//   { created_at, meta: { to } }

import { FUNNEL_ORDER, STAGE_LABELS } from "./stage-labels";
import { STRONG_MATCH_MIN, REVIEW_MIN } from "./scoreBands";

const DAY = 86400000;

export const PERIOD_DAYS = { "30d": 30, "90d": 90, "365d": 365 };
const MAX_CUSTOM_DAYS = 3660;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// { from, to } (Dates, `to` exclusive) for the period the page asked for,
// plus the window of the same length straight before it to compare with.
// "all" has no bounds and nothing to compare with.
//   period: "all" | "30d" | "90d" | "365d" | "custom" (with from/to as
//   YYYY-MM-DD, both days included)
/** @param {{ period?: string, from?: string, to?: string }} [range] */
export function resolveRange({ period, from, to } = {}, now = Date.now()) {
  let start = null;
  let end = null;
  if (period === "custom") {
    let first = parseDay(from);
    let last = parseDay(to);
    if (first && last && last < first) [first, last] = [last, first];
    start = first;
    end = last ? new Date(last.getTime() + DAY) : null;
    if (start && end && end.getTime() - start.getTime() > MAX_CUSTOM_DAYS * DAY) start = new Date(end.getTime() - MAX_CUSTOM_DAYS * DAY);
    if (!start && !end) return { from: null, to: null, previous: null, days: null };
  } else if (PERIOD_DAYS[period]) {
    end = new Date(now);
    start = new Date(now - PERIOD_DAYS[period] * DAY);
  } else {
    return { from: null, to: null, previous: null, days: null };
  }
  if (!start || !end) {
    // Open-ended custom range ("since X" or "until Y") - nothing of equal
    // length to compare it with.
    return { from: start, to: end, previous: null, days: null };
  }
  const length = end.getTime() - start.getTime();
  return {
    from: start,
    to: end,
    previous: { from: new Date(start.getTime() - length), to: start },
    days: Math.round(length / DAY),
  };
}

// The furthest funnel stage a candidate ever reached, as an index into
// FUNNEL_ORDER (-1 = never staged). Someone rejected after their interview
// reached Interview - their current stage alone ("Rejected") would say
// they never got past the start, which made every conversion rate read low.
export function furthestStageIndex(candidate, transitions = []) {
  let best = FUNNEL_ORDER.indexOf(candidate.stage);
  for (const t of transitions) {
    const idx = FUNNEL_ORDER.indexOf(t?.meta?.to);
    if (idx > best) best = idx;
  }
  // Rejected with no recorded history: they were in the pipeline, so they
  // were at least screened (every analysed candidate starts there).
  if (best < 0 && candidate.stage === "Rejected") best = 0;
  return best;
}

// When a candidate was placed: the last move into Placed, if recorded.
export function placedAt(transitions = []) {
  let at = null;
  for (const t of transitions) if (t?.meta?.to === "Placed") at = t.created_at;
  return at;
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// The headline numbers for one set of candidates.
//   furthest: Map candidateId -> furthestStageIndex
export function computeCore(candidates, furthest, now = Date.now()) {
  const completed = candidates.filter((c) => (c.processing_status || "completed") === "completed");
  const processing = candidates.filter((c) => c.processing_status === "processing").length;
  const failed = candidates.filter((c) => c.processing_status === "failed").length;

  const reach = (c) => furthest.get(c.id) ?? FUNNEL_ORDER.indexOf(c.stage);
  const reachedAtLeast = (idx) => completed.filter((c) => reach(c) >= idx).length;

  const funnel = FUNNEL_ORDER.map((key, idx) => ({ key, label: STAGE_LABELS[key], count: reachedAtLeast(idx) }));

  const scored = completed.filter((c) => typeof c.match_score === "number");
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.match_score, 0) / scored.length) : 0;
  const strong = scored.filter((c) => c.match_score >= STRONG_MATCH_MIN).length;
  const moderate = scored.filter((c) => c.match_score >= REVIEW_MIN && c.match_score < STRONG_MATCH_MIN).length;
  const weak = scored.filter((c) => c.match_score < REVIEW_MIN).length;

  const stageCounts = {};
  Object.keys(STAGE_LABELS).forEach((k) => (stageCounts[k] = completed.filter((c) => c.stage === k).length));

  const midStages = FUNNEL_ORDER.slice(1, -1);
  const stalled = completed.filter((c) => {
    if (!midStages.includes(c.stage)) return false;
    const since = c.last_activity_at || c.created_at;
    return since && new Date(since).getTime() < now - 5 * DAY;
  }).length;

  const placed = completed.filter((c) => c.stage === "Placed").length;
  const idx = (stage) => FUNNEL_ORDER.indexOf(stage);

  return {
    totals: { totalCandidates: candidates.length, completed: completed.length, processing, failed },
    funnel,
    quality: { avgScore, strong, moderate, weak, scoredCount: scored.length },
    pipeline: { stageCounts, stalled },
    conversion: {
      shortlistRate: pct(reachedAtLeast(idx("Shortlisted")), completed.length),
      interviewRate: pct(reachedAtLeast(idx("Interview")), completed.length),
      offerRate: pct(reachedAtLeast(idx("Offer")), completed.length),
      placementRate: pct(placed, completed.length),
    },
    calibration: computeScoreCalibration(completed),
  };
}

const CALIBRATION_MIN_SAMPLE = 10;
const CALIBRATION_BANDS = [
  { key: "80+", label: "80+", test: (s) => s >= STRONG_MATCH_MIN },
  { key: "60-79", label: "60-79", test: (s) => s >= REVIEW_MIN && s < STRONG_MATCH_MIN },
  { key: "<60", label: "Below 60", test: (s) => s < REVIEW_MIN },
];

// Whether a higher match score actually predicts a better outcome, from
// this agency's own resolved candidates (Placed or Rejected) - anyone still
// mid-pipeline hasn't resolved yet and would bias the rate either way.
export function computeScoreCalibration(completed) {
  const resolved = completed.filter((c) => (c.stage === "Placed" || c.stage === "Rejected") && typeof c.match_score === "number");
  const bands = CALIBRATION_BANDS.map((band) => {
    const inBand = resolved.filter((c) => band.test(c.match_score));
    const placedInBand = inBand.filter((c) => c.stage === "Placed").length;
    return {
      key: band.key,
      label: band.label,
      total: inBand.length,
      placed: placedInBand,
      placementRate: inBand.length ? Math.round((placedInBand / inBand.length) * 100) : null,
    };
  });
  return { sampleSize: resolved.length, hasEnoughData: resolved.length >= CALIBRATION_MIN_SAMPLE, minSample: CALIBRATION_MIN_SAMPLE, bands };
}

// Per recruiter, from the same filtered candidates as everything else.
//   people: [{ id, name }]
export function computeTeam(candidates, people) {
  const byId = new Map(people.map((p) => [p.id, { id: p.id, name: p.name, activeCandidates: 0, placed: 0, total: 0 }]));
  for (const c of candidates) {
    const r = byId.get(c.recruiter_id);
    if (!r) continue;
    r.total += 1;
    if ((c.processing_status || "completed") !== "completed") continue;
    if (c.stage === "Placed") r.placed += 1;
    else if (c.stage !== "Rejected") r.activeCandidates += 1;
  }
  return [...byId.values()].filter((r) => r.total > 0).sort((a, b) => b.placed - a.placed || b.activeCandidates - a.activeCandidates || a.name.localeCompare(b.name));
}

// Change from the previous period, per headline figure. null where there's
// nothing to compare with.
export function computeDeltas(current, previous) {
  if (!previous) return null;
  const diff = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : null);
  return {
    completed: diff(current.totals.completed, previous.totals.completed),
    avgScore: previous.quality.scoredCount ? diff(current.quality.avgScore, previous.quality.avgScore) : null,
    shortlistRate: previous.totals.completed ? diff(current.conversion.shortlistRate, previous.conversion.shortlistRate) : null,
    interviewRate: previous.totals.completed ? diff(current.conversion.interviewRate, previous.conversion.interviewRate) : null,
    offerRate: previous.totals.completed ? diff(current.conversion.offerRate, previous.conversion.offerRate) : null,
    placementRate: previous.totals.completed ? diff(current.conversion.placementRate, previous.conversion.placementRate) : null,
  };
}

function startOfWeek(d) {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}
function startOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const MAX_BUCKETS = 24;

// Analysed, placed and fees over time. Weekly for ranges up to ~3 months,
// monthly beyond that; "all time" covers the last 24 months with data.
//   placements: [{ at (ISO), fee (number|null) }]
export function computeTrends(candidates, placements, range, now = Date.now()) {
  const end = range?.to ? new Date(range.to.getTime() - 1) : new Date(now);
  let start = range?.from ?? null;
  if (!start) {
    const earliest = candidates.reduce((min, c) => {
      const t = c.created_at ? new Date(c.created_at).getTime() : NaN;
      return Number.isFinite(t) && t < min ? t : min;
    }, end.getTime());
    start = new Date(earliest);
  }
  const days = (end.getTime() - start.getTime()) / DAY;
  const unit = days <= 100 ? "week" : "month";
  const floor = unit === "week" ? startOfWeek : startOfMonth;
  const step = (d) =>
    unit === "week" ? new Date(d.getTime() + 7 * DAY) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

  const buckets = [];
  for (let d = floor(start); d <= end; d = step(d)) buckets.push({ start: d, analysed: 0, placed: 0, fees: 0 });
  const kept = buckets.slice(-MAX_BUCKETS);
  if (kept.length === 0) return { unit, points: [] };
  const firstStart = kept[0].start.getTime();
  const index = new Map(kept.map((b, i) => [b.start.getTime(), i]));
  const bucketFor = (iso) => {
    if (!iso) return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime()) || t.getTime() < firstStart || t > end) return null;
    const i = index.get(floor(t).getTime());
    return i === undefined ? null : kept[i];
  };

  for (const c of candidates) {
    const b = bucketFor(c.created_at);
    if (b) b.analysed += 1;
  }
  for (const p of placements) {
    const b = bucketFor(p.at);
    if (!b) continue;
    b.placed += 1;
    if (typeof p.fee === "number" && Number.isFinite(p.fee)) b.fees += p.fee;
  }

  return {
    unit,
    points: kept.map((b) => ({
      start: b.start.toISOString().slice(0, 10),
      label:
        unit === "week"
          ? b.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
          : b.start.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      analysed: b.analysed,
      placed: b.placed,
      fees: Math.round(b.fees * 100) / 100,
    })),
  };
}
