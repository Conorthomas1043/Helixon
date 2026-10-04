// Server-side loaders shared by the Analytics endpoints
// (app/api/analytics/snapshot, app/api/analytics/timing) and the weekly
// digest, so every figure is computed from the same filtered rows.
//
// Both loaders page through results: a plain select stops at the
// database's row limit (1,000 by default) without saying so, and a single
// .in() with thousands of ids is too long a request to send.

import "server-only";
import { supabase } from "@/lib/supabase";
import { cleanUuid } from "@/lib/sanitize";
import { placedAt, resolveRange } from "@/lib/analytics-snapshot";

const PAGE = 1000;
// A limit to stop a runaway loop, not an expected agency size.
const ROW_CAP = 50000;
const ID_CHUNK = 200;

// The Analytics page's filters from a request's query string:
//   period (all|30d|90d|365d|custom), from, to (YYYY-MM-DD, custom only),
//   jobId, recruiterId, clientId
export function readAnalyticsFilters(params, now = Date.now()) {
  const period = ["all", "30d", "90d", "365d", "custom"].includes(params.get("period")) ? params.get("period") : "all";
  // The timing endpoint used to take ?days=N - still accepted.
  const days = Number(params.get("days"));
  const legacyPeriod = period === "all" && [30, 90, 365].includes(days) ? `${days}d` : null;
  return {
    period: legacyPeriod || period,
    range: resolveRange({ period: legacyPeriod || period, from: params.get("from"), to: params.get("to") }, now),
    jobId: cleanUuid(params.get("jobId")),
    recruiterId: (params.get("recruiterId") || "").slice(0, 100) || null,
    clientId: cleanUuid(params.get("clientId")),
    officeId: /^[a-z0-9-]{1,40}$/.test(params.get("officeId") || "") ? params.get("officeId") : null,
  };
}

// The job ids a client and/or office filter narrows to. null = neither.
export async function jobIdsForClient(agencyId, clientId, officeId = null) {
  if (!clientId && !officeId) return { jobIds: null, error: null };
  let q = supabase.from("jobs").select("id").eq("agency_id", agencyId);
  if (clientId) q = q.eq("client_id", clientId);
  if (officeId) q = q.eq("office_id", officeId);
  const { data, error } = await q.limit(5000);
  if (error) return { jobIds: null, error };
  return { jobIds: (data ?? []).map((j) => j.id), error: null };
}

// Every candidate row matching the filters, created within [from, to).
//   window: { from: Date|null, to: Date|null } - defaults to the filters'
//   range; pass { from: null, to: null } for all time.
//   extra(query) - optional further narrowing (e.g. only placed rows).
export async function loadCandidates(agencyId, filters, columns, { window, jobIds, extra } = {}) {
  const range = window ?? filters.range;
  if (Array.isArray(jobIds) && jobIds.length === 0) return { data: [], error: null, truncated: false };
  let all = [];
  for (let from = 0; from < ROW_CAP; from += PAGE) {
    let q = supabase.from("candidates").select(columns).eq("agency_id", agencyId);
    if (filters.jobId) q = q.eq("job_id", filters.jobId);
    if (Array.isArray(jobIds)) q = q.in("job_id", jobIds);
    if (filters.recruiterId) q = q.eq("recruiter_id", filters.recruiterId);
    if (range?.from) q = q.gte("created_at", range.from.toISOString());
    if (range?.to) q = q.lt("created_at", range.to.toISOString());
    if (extra) q = extra(q);
    const { data, error } = await q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) return { data: null, error, truncated: false };
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE) return { data: all, error: null, truncated: false };
  }
  return { data: all, error: null, truncated: true };
}

// candidate_activity rows for these candidates, oldest first, optionally
// only some types.
export async function loadActivity(candidateIds, { types, columns = "candidate_id, type, meta, created_at" } = {}) {
  const ids = [...new Set(candidateIds)];
  let all = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; from < ROW_CAP; from += PAGE) {
      let q = supabase.from("candidate_activity").select(columns).in("candidate_id", chunk);
      if (types) q = q.in("type", types);
      const { data, error } = await q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) return { data: null, error };
      all = all.concat(data ?? []);
      if (!data || data.length < PAGE) break;
    }
  }
  all.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return { data: all, error: null };
}

// candidateId -> [stage_changed rows], oldest first.
export function groupTransitions(activity) {
  const map = new Map();
  for (const row of activity ?? []) {
    if (row.type !== "stage_changed") continue;
    if (!map.has(row.candidate_id)) map.set(row.candidate_id, []);
    map.get(row.candidate_id).push(row);
  }
  return map;
}

// Every placement matching the filters (by job/recruiter, not by when the
// candidate was added): [{ id, at, fee }]. `at` is the last recorded move
// into Placed; with no recorded move (set before history was kept), the
// last activity on the record is the nearest date there is.
export async function loadPlacements(agencyId, filters, { jobIds } = {}) {
  const { data, error, truncated } = await loadCandidates(agencyId, filters, "id, created_at, last_activity_at, placement_fee", {
    jobIds,
    window: { from: null, to: null },
    extra: (q) => q.eq("stage", "Placed"),
  });
  if (error) return { data: null, error, truncated: false };
  const { data: activity, error: activityError } = await loadActivity(data.map((c) => c.id), { types: ["stage_changed"] });
  if (activityError) return { data: null, error: activityError, truncated: false };
  const transitions = groupTransitions(activity);
  return {
    data: data.map((c) => ({
      id: c.id,
      at: placedAt(transitions.get(c.id)) || c.last_activity_at || c.created_at,
      fee: c.placement_fee == null ? null : Number(c.placement_fee),
    })),
    error: null,
    truncated,
  };
}

// Whether an ISO date falls in [range.from, range.to).
export function inRange(iso, range) {
  if (!iso) return false;
  const t = new Date(iso);
  return (!range?.from || t >= range.from) && (!range?.to || t < range.to);
}
