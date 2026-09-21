"use client";

/* ------------------------------------------------------------------------
 * Thin fetch wrappers around the real candidate/job/team API routes
 * (app/api/candidates, app/api/jobs, app/api/team), mirroring the function
 * names lib/mock-data.js used to export. The dashboard pages were written
 * against that mock module by design ("swapping its body for a real
 * fetch() should be a one-file change" - see mock-data.js's header
 * comment); this file is that swap. Call sites mostly just gained
 * await/useEffect around what used to be synchronous mock calls.
 *
 * Stage values are the real ones from lib/stage-labels.js (Screened/
 * Shortlisted/Interview/Offer/Placed/Rejected), not the mock's invented
 * lowercase set - every page importing STAGE_LABELS/STAGE_ORDER should
 * import them from lib/stage-labels.js instead of lib/mock-data.js.
 * ---------------------------------------------------------------------- */

import { FUNNEL_ORDER, STAGE_LABELS } from "@/lib/stage-labels";

async function apiFetch(url, options) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

function buildCandidatesQuery(query = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.stage && query.stage !== "all") params.set("stage", query.stage);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.recruiterId && query.recruiterId !== "all") params.set("recruiterId", query.recruiterId);
  if (query.jobId && query.jobId !== "all") params.set("jobId", query.jobId);
  if (query.scoreBand && query.scoreBand !== "all") params.set("scoreBand", query.scoreBand);
  if (query.dateRange && query.dateRange !== "all") params.set("dateRange", query.dateRange);
  if (query.tagIds && query.tagIds.length > 0) params.set("tagIds", query.tagIds.join(","));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  params.set("page", String(query.page || 1));
  params.set("pageSize", String(query.pageSize || 8));
  return params;
}

export async function getCandidates(query = {}) {
  return apiFetch(`/api/candidates?${buildCandidatesQuery(query).toString()}`);
}

// The API caps pageSize at 50 server-side (app/api/candidates/route.js)
// regardless of what's requested - callers that need "every matching
// candidate" (stage counts, analytics, CSV export) previously asked for
// pageSize: 1000 assuming that's what they'd get, which the server always
// silently clamped down to 50. That's not a performance nuance, it's a
// correctness bug: any agency with more than 50 candidates matching a
// filter got numbers computed from an arbitrary 50-row subset with no
// indication anything was missing. This pages through every result
// instead, using totalPages from each real response rather than assuming
// a page size - capped at 100 pages (5,000 candidates) as a sanity limit
// against a runaway loop, not because that's an expected agency size.
async function getAllCandidates(query = {}) {
  const { page, pageSize, ...rest } = query;
  let all = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const result = await getCandidates({ ...rest, page: currentPage, pageSize: 50 });
    all = all.concat(result.items ?? []);
    totalPages = result.totalPages ?? 1;
    currentPage += 1;
  } while (currentPage <= totalPages && currentPage <= 100);

  return all;
}

/**
 * getStageCounts - there's no dedicated facets endpoint, so this fetches
 * every candidate matching the current filters (ignoring `stage` itself
 * and pagination) and counts client-side, same as the mock version did.
 */
export async function getStageCounts(query = {}) {
  const { stage, page, pageSize, ...rest } = query;
  const items = await getAllCandidates({ ...rest, stage: "all" });
  const counts = { all: items.length };
  Object.keys(STAGE_LABELS).forEach((s) => {
    counts[s] = items.filter((c) => c.stage === s).length;
  });
  return counts;
}

// Real, unpaginated candidate export - CSV download on the Candidates page.
export async function getCandidatesForExport(query = {}) {
  return getAllCandidates(query);
}

export async function getCandidateById(id) {
  const candidate = await apiFetch(`/api/candidates/${id}`);
  return { ...candidate, job: candidate.job ? { ...candidate.job, company: candidate.job.client } : null };
}

// Job rows come back from the API in their raw (snake_case) DB column
// names; the dashboard pages were built against the mock module's
// camelCase job shape, so adapt here rather than in every page.
function adaptJob(j) {
  return {
    ...j,
    company: j.client,
    employmentType: j.employment_type,
    salaryRange: j.salary_range,
    requiredSkills: j.required_skills ?? [],
    preferredSkills: j.preferred_skills ?? [],
    minYearsExperience: j.min_years_experience,
  };
}

export async function getJobs() {
  const jobs = await apiFetch("/api/jobs");
  return jobs.map(adaptJob);
}

export async function getJobById(id) {
  const job = await apiFetch(`/api/jobs/${id}`);
  return adaptJob(job);
}

export async function getJobCandidates(jobId) {
  return apiFetch(`/api/jobs/${jobId}/candidates`);
}

export async function getRecruiters() {
  return apiFetch("/api/team");
}

// Unlike apiFetch, this doesn't throw on a non-2xx - the caller needs to
// tell "403, you're not on the Agency plan" (hide the invite UI entirely)
// apart from a real failure (show an error state), which a thrown Error
// with just a message string can't distinguish reliably.
export async function getTeamSeatUsage() {
  const res = await fetch("/api/team/invite", { credentials: "include" });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export async function inviteTeammate(email) {
  return apiFetch("/api/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function cancelTeamInvite(invitationId) {
  return apiFetch("/api/team/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitationId }),
  });
}

// Removes an existing (already-accepted) team member, freeing their seat.
// Same endpoint as cancelTeamInvite, distinguished by { userId } instead of
// { invitationId } - see app/api/team/invite's DELETE handler.
export async function removeTeammate(userId) {
  return apiFetch("/api/team/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

export async function updateCandidateStage(id, newStage) {
  return apiFetch(`/api/candidates/${id}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage: newStage }),
  });
}

// Permanently erases the candidate and every row referencing them (scores,
// notes, artifacts, shortlist entries, feedback) - see app/api/candidates/
// [id]/route.js's DELETE handler. This is the tool an agency needs to
// fulfil a candidate's right-to-erasure request.
export async function deleteCandidate(id) {
  return apiFetch(`/api/candidates/${id}`, { method: "DELETE" });
}

export async function assignCandidate(id, recruiterId) {
  return apiFetch(`/api/candidates/${id}/assignment`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recruiterId }),
  });
}

export async function addCandidateNote(id, body) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function addCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagId }),
  });
}

export async function removeCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags/${tagId}`, { method: "DELETE" });
}

export async function setCandidateNextAction(id, { label, dueAt }) {
  return apiFetch(`/api/candidates/${id}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, dueAt }),
  });
}

export async function completeNextAction(id) {
  return apiFetch(`/api/candidates/${id}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
}

/**
 * getAnalyticsSnapshot - app/api/analytics is a real, agency-scoped
 * endpoint but returns a different (thinner) shape than this dashboard's
 * analytics page needs (see its own header comment: funnel/quality/
 * pipeline/conversion/team). Rather than build a second server-side
 * aggregation for the same data, this reduces the real candidate list
 * client-side - the same trade-off lib/mock-data.js's own version flagged
 * ("a real backend should aggregate this server-side... at production
 * scale"), just now running over real rows instead of 26 fake ones.
 */
export async function getAnalyticsSnapshot() {
  const [candidates, team] = await Promise.all([
    getAllCandidates({ sortBy: "newest" }),
    getRecruiters(),
  ]);

  const completed = candidates.filter((c) => c.status === "completed");
  const processing = candidates.filter((c) => c.status === "processing").length;
  const failed = candidates.filter((c) => c.status === "failed").length;

  const funnel = FUNNEL_ORDER.map((key, idx) => ({
    key,
    label: STAGE_LABELS[key],
    count: completed.filter((c) => FUNNEL_ORDER.indexOf(c.stage) >= idx).length,
  }));

  const scored = completed.filter((c) => c.score !== null && c.score !== undefined);
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
  const strong = scored.filter((c) => c.score >= 80).length;
  const moderate = scored.filter((c) => c.score >= 60 && c.score < 80).length;
  const weak = scored.filter((c) => c.score < 60).length;

  const stageCounts = {};
  Object.keys(STAGE_LABELS).forEach((k) => (stageCounts[k] = completed.filter((c) => c.stage === k).length));

  const midStages = FUNNEL_ORDER.slice(1, -1);
  const now = Date.now();
  const DAY = 86400000;
  const stalled = completed.filter(
    (c) => midStages.includes(c.stage) && c.lastActivityAt && new Date(c.lastActivityAt).getTime() < now - 5 * DAY
  ).length;

  const placed = completed.filter((c) => c.stage === "Placed").length;
  const reachedOrFurther = (from) =>
    completed.filter((c) => FUNNEL_ORDER.indexOf(c.stage) >= FUNNEL_ORDER.indexOf(from)).length;

  return {
    totals: {
      totalCandidates: candidates.length,
      completed: completed.length,
      processing,
      failed,
    },
    funnel,
    quality: { avgScore, strong, moderate, weak, scoredCount: scored.length },
    pipeline: { stageCounts, stalled },
    conversion: {
      shortlistRate: completed.length ? Math.round((reachedOrFurther("Shortlisted") / completed.length) * 100) : 0,
      interviewRate: completed.length ? Math.round((reachedOrFurther("Interview") / completed.length) * 100) : 0,
      offerRate: completed.length ? Math.round((reachedOrFurther("Offer") / completed.length) * 100) : 0,
      placementRate: completed.length ? Math.round((placed / completed.length) * 100) : 0,
    },
    team,
  };
}
