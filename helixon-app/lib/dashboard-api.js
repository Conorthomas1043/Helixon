"use client";

// Thin fetch wrappers the dashboard and analyse pages use to reach the real
// API routes (app/api/candidates, jobs, team, analytics/timing ...). Each
// throws an Error carrying the server's message on a non-2xx response,
// except where a caller needs the status itself (getTeamSeatUsage). Stage
// values come from lib/stage-labels.js.

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
  if (query.near) {
    params.set("near", query.near);
    params.set("radius", String(query.radius || 25));
  }
  if (query.stage && query.stage !== "all") params.set("stage", query.stage);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.recruiterId && query.recruiterId !== "all") params.set("recruiterId", query.recruiterId);
  if (query.jobId && query.jobId !== "all") params.set("jobId", query.jobId);
  if (query.scoreBand && query.scoreBand !== "all") params.set("scoreBand", query.scoreBand);
  if (query.dateRange && query.dateRange !== "all") params.set("dateRange", query.dateRange);
  if (query.pool) params.set("pool", "1");
  if (query.tagIds && query.tagIds.length > 0) params.set("tagIds", query.tagIds.join(","));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  params.set("page", String(query.page || 1));
  params.set("pageSize", String(query.pageSize || 8));
  return params;
}

export async function getCandidates(query = {}) {
  return apiFetch(`/api/candidates?${buildCandidatesQuery(query).toString()}`);
}

// The API caps pageSize at 200 (app/api/candidates/route.js), so callers
// that need "every matching candidate" (stage counts, analytics, pipeline,
// CSV export) page through the whole result using totalPages from each
// real response. 200 per page keeps a large agency to a handful of
// requests (it was 50, i.e. 100 sequential requests for 5,000 candidates).
// Capped at 100 pages (20,000 candidates) against a runaway loop.
async function getAllCandidates(query = {}) {
  const { page, pageSize, ...rest } = query;
  let all = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const result = await getCandidates({ ...rest, page: currentPage, pageSize: 200 });
    all = all.concat(result.items ?? []);
    totalPages = result.totalPages ?? 1;
    currentPage += 1;
  } while (currentPage <= totalPages && currentPage <= 100);

  return all;
}

/**
 * getStageCounts - there's no dedicated facets endpoint, so this fetches
 * every candidate matching the current filters (ignoring `stage` itself
 * and pagination) and counts client-side.
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

// Every candidate for the pipeline board - the board used to ask for
// pageSize: 500 and silently got the server's 50-row cap.
export async function getPipelineCandidates(query = {}) {
  return getAllCandidates(query);
}

// Real, unpaginated candidate export - CSV download on the Candidates page.
export async function getCandidatesForExport(query = {}) {
  return getAllCandidates(query);
}

export async function getCandidateById(id) {
  const candidate = await apiFetch(`/api/candidates/${id}`);
  return { ...candidate, job: candidate.job ? { ...candidate.job, company: candidate.job.client } : null };
}

// Name, contact details and current role, as corrected by a recruiter - see
// app/api/candidates/[id]/route.js's PATCH.
export async function updateCandidateContact(id, fields) {
  return apiFetch(`/api/candidates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Self-reported fields: source of hire, rejection reason, placement fee/
// cost, 30/90-day retention. See app/api/candidates/[id]/details/route.js.
export async function updateCandidateDetails(id, fields) {
  return apiFetch(`/api/candidates/${id}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Manual outreach logging (call/email/meeting/CV sent) - see
// app/api/candidates/[id]/activity/route.js.
export async function logCandidateActivity(id, type, note) {
  return apiFetch(`/api/candidates/${id}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
}

// Candidate NPS / hiring-manager feedback requests - see
// app/api/candidates/[id]/feedback-requests/route.js.
export async function getFeedbackRequests(candidateId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/feedback-requests`);
  return res.requests;
}

// With sendTo the link is also emailed; the result says whether it went
// ({ request, emailedTo, sendError }) - the link exists either way.
export async function createFeedbackRequest(candidateId, { kind, recipientLabel, sendTo }) {
  return apiFetch(`/api/candidates/${candidateId}/feedback-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, recipientLabel, sendTo: sendTo || undefined }),
  });
}

// Emails an existing, unanswered feedback link.
export async function emailFeedbackRequest(candidateId, requestId, sendTo) {
  return apiFetch(`/api/candidates/${candidateId}/feedback-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, sendTo }),
  });
}

// Job rows come back from the API in their raw (snake_case) DB column
// names; the pages use a camelCase job shape, so adapt here rather than in
// every page.
function adaptJob(j) {
  return {
    ...j,
    company: j.client,
    clientEmail: j.client_email ?? null,
    clientId: j.client_id ?? null,
    contactId: j.contact_id ?? null,
    published: Boolean(j.published),
    publishedAt: j.published_at ?? null,
    publicTitle: j.public_title ?? null,
    publicDescription: j.public_description ?? null,
    hideClient: j.hide_client ?? true,
    showSalary: j.show_salary ?? true,
    employmentType: j.employment_type,
    salaryRange: j.salary_range,
    requiredSkills: j.required_skills ?? [],
    preferredSkills: j.preferred_skills ?? [],
    minYearsExperience: j.min_years_experience,
  };
}

// Creates a job directly (not as a side effect of screening a CV) - see
// app/api/jobs/route.js's POST. `fields`: { title, company, location,
// employmentType, seniority, salaryRange, requiredSkills, preferredSkills,
// minYearsExperience, jobText }.
export async function createJob(fields) {
  const job = await apiFetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return adaptJob(job);
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

// Sourcing-channel clicks/spend for one job - see
// app/api/jobs/[id]/channels/route.js.
export async function getJobChannels(jobId) {
  const res = await apiFetch(`/api/jobs/${jobId}/channels`);
  return res.channels;
}

export async function setJobChannel(jobId, { channel, clicks, spend }) {
  const res = await apiFetch(`/api/jobs/${jobId}/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, clicks, spend }),
  });
  return res.channel;
}

export async function updateJobStatus(jobId, status) {
  return apiFetch(`/api/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// `fields` is whatever subset of { title, client, location, employmentType,
// seniority, minYearsExperience, requiredSkills, preferredSkills, status }
// changed - api/jobs/[id]'s PATCH only updates the keys actually present.
export async function updateJob(jobId, fields) {
  const job = await apiFetch(`/api/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return adaptJob(job.job);
}

// Refuses (409) if the job has any candidates attached - see api/jobs/[id]'s
// DELETE handler for why.
export async function deleteJob(jobId) {
  return apiFetch(`/api/jobs/${jobId}`, { method: "DELETE" });
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
// { invitationId } - see app/api/team/invite's DELETE handler. reassignTo:
// a remaining member's id to take over their candidates, null to leave them
// unassigned, or undefined to leave them as they are.
export async function removeTeammate(userId, reassignTo) {
  return apiFetch("/api/team/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reassignTo === undefined ? { userId } : { userId, reassignTo }),
  });
}

// Your own presence on the Team page: status "busy" | "away" | null
// (automatic), with an optional message and end time (ISO).
export async function setMyPresence({ status = null, message = "", until = null } = {}) {
  return apiFetch("/api/team/presence", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, message, until }),
  });
}

// Data & privacy (/dashboard/privacy, app/api/privacy).
export async function getPrivacyOverview() {
  return apiFetch("/api/privacy");
}

export async function updatePrivacySettings(fields) {
  return apiFetch("/api/privacy", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function keepCandidates(ids) {
  return apiFetch("/api/privacy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "keep", ids }),
  });
}

// Stop (true) or start (false) sharing your presence; stopping deletes
// what's been recorded.
export async function setPresenceHidden(hidden) {
  return apiFetch("/api/team/presence", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hidden }),
  });
}

// role: "admin" (can manage the team) or "member".
export async function setTeammateRole(userId, role) {
  return apiFetch("/api/team/role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role }),
  });
}

// Hands every candidate no current member owns to one team member.
export async function assignUnassignedCandidates(toUserId) {
  return apiFetch("/api/team/invite", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reassignUnassignedTo: toUserId }),
  });
}

// One request for a bulk action on the Candidates list - see
// app/api/candidates/bulk. payload: { action: "stage", stage } |
// { action: "tag", tagId } | { action: "delete" }.
export async function bulkUpdateCandidates(ids, payload) {
  return apiFetch("/api/candidates/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ...payload }),
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
// everyRecord: also erase the other records for this person (one per job
// they were screened for) - what a GDPR erasure request needs.
export async function deleteCandidate(id, { everyRecord = false } = {}) {
  return apiFetch(`/api/candidates/${id}${everyRecord ? "?all=1" : ""}`, { method: "DELETE" });
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

// Talent pool - see app/api/talent-pool and app/api/candidates/[id]/talent-pool.
export async function getTalentPool({ jobId = "" } = {}) {
  return apiFetch(`/api/talent-pool${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`);
}

// fields: { note?, status?: "available" | "open" | "not_looking" | null, checkIn?: "YYYY-MM-DD" | null }
export async function updateTalentPoolEntry(id, fields) {
  return (
    await apiFetch(`/api/candidates/${id}/talent-pool`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
  ).talentPool;
}

export async function saveToTalentPool(id, note = "") {
  return (
    await apiFetch(`/api/candidates/${id}/talent-pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })
  ).talentPool;
}

export async function removeFromTalentPool(id) {
  return apiFetch(`/api/candidates/${id}/talent-pool`, { method: "DELETE" });
}

// Screens someone already on file against another job, reusing their CV.
// Resolves { candidateId, score, recommendation, job }; a 409 means they're
// already screened for it (err.existingId).
export async function rescreenCandidate(id, jobId) {
  const res = await fetch(`/api/candidates/${id}/rescreen`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || "Couldn't screen this candidate.");
    err.status = res.status;
    err.existingId = data?.existingId || null;
    throw err;
  }
  return data;
}

export async function getTags() {
  return (await apiFetch("/api/tags")).tags;
}

export async function createTag(label) {
  return (
    await apiFetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    })
  ).tag;
}

export async function deleteTag(id) {
  return apiFetch(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function editCandidateNote(id, noteId, body) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, body }),
  });
}

export async function deleteCandidateNote(id, noteId) {
  return apiFetch(`/api/candidates/${id}/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" });
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
 * client-side. At much larger scale this belongs in a server-side
 * aggregate query instead.
 */
// Speed/efficiency + offer-acceptance figures from app/api/analytics/timing
// - a separate, server-aggregated call (it needs candidate_activity's full
// stage-transition history, which getAllCandidates()'s per-candidate rows
// don't carry). Fails soft: a broken/slow timing query shouldn't blank out
// the rest of the Analytics page, which has real value without it.
async function getTimingSnapshot(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.jobId && filters.jobId !== "all") params.set("jobId", filters.jobId);
    if (filters.recruiterId && filters.recruiterId !== "all") params.set("recruiterId", filters.recruiterId);
    if (ANALYTICS_PERIOD_DAYS[filters.period]) params.set("days", String(ANALYTICS_PERIOD_DAYS[filters.period]));
    const data = await apiFetch(`/api/analytics/timing?${params.toString()}`);
    if (!data.ok) return null;
    return data;
  } catch {
    return null;
  }
}

// Analytics page periods -> days (candidates created in that window).
export const ANALYTICS_PERIOD_DAYS = { "30d": 30, "90d": 90, "365d": 365 };

// filters: { period: "all" | "30d" | "90d" | "365d", jobId, recruiterId }
export async function getAnalyticsSnapshot(filters = {}) {
  const [candidates, allTeam, timing] = await Promise.all([
    getAllCandidates({
      sortBy: "newest",
      jobId: filters.jobId,
      recruiterId: filters.recruiterId,
      dateRange: ANALYTICS_PERIOD_DAYS[filters.period] ? filters.period : "all",
    }),
    getRecruiters(),
    getTimingSnapshot(filters),
  ]);
  const team = filters.recruiterId && filters.recruiterId !== "all" ? allTeam.filter((r) => r.id === filters.recruiterId) : allTeam;

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

  const calibration = computeScoreCalibration(completed);

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
    calibration,
    team,
    timing,
  };
}

const CALIBRATION_MIN_SAMPLE = 10;
const CALIBRATION_BANDS = [
  { key: "80+", label: "80+", test: (s) => s >= 80 },
  { key: "60-79", label: "60-79", test: (s) => s >= 60 && s < 80 },
  { key: "<60", label: "Below 60", test: (s) => s < 60 },
];

// Whether a higher match score actually predicts a better outcome is an
// empirical question this agency's own history can answer - and the only
// honest way to answer it, since no accuracy figure produced anywhere else
// in this product was ever measured against a real recruiting outcome.
// Only candidates who've reached a terminal stage (Placed or Rejected)
// count as a resolved outcome - anyone still mid-pipeline hasn't resolved
// yet and would bias the rate if counted either way.
function computeScoreCalibration(completed) {
  const resolved = completed.filter(
    (c) => (c.stage === "Placed" || c.stage === "Rejected") && typeof c.score === "number"
  );

  const bands = CALIBRATION_BANDS.map((band) => {
    const inBand = resolved.filter((c) => band.test(c.score));
    const placedInBand = inBand.filter((c) => c.stage === "Placed").length;
    return {
      key: band.key,
      label: band.label,
      total: inBand.length,
      placed: placedInBand,
      placementRate: inBand.length ? Math.round((placedInBand / inBand.length) * 100) : null,
    };
  });

  return {
    sampleSize: resolved.length,
    hasEnoughData: resolved.length >= CALIBRATION_MIN_SAMPLE,
    minSample: CALIBRATION_MIN_SAMPLE,
    bands,
  };
}

// Shortlists - see app/api/shortlists. `candidateId` marks which lists
// already have that person on them (containsCandidate).
export async function getShortlists({ jobId, candidateId } = {}) {
  const params = new URLSearchParams();
  if (jobId) params.set("jobId", jobId);
  if (candidateId) params.set("candidateId", candidateId);
  const res = await apiFetch(`/api/shortlists?${params.toString()}`);
  return res.shortlists;
}

export async function createShortlist({ name, jobId = null, candidateIds = [] }) {
  const res = await apiFetch("/api/shortlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, jobId, candidateIds }),
  });
  return res.shortlist;
}

export async function getShortlist(id) {
  return apiFetch(`/api/shortlists/${id}`);
}

export async function updateShortlist(id, fields) {
  const res = await apiFetch(`/api/shortlists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.shortlist;
}

export async function deleteShortlist(id) {
  return apiFetch(`/api/shortlists/${id}`, { method: "DELETE" });
}

export async function addToShortlist(id, candidateIds, note = null) {
  return apiFetch(`/api/shortlists/${id}/candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, note }),
  });
}

export async function setShortlistNote(id, candidateId, note) {
  return apiFetch(`/api/shortlists/${id}/candidates`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, note }),
  });
}

export async function removeFromShortlist(id, candidateId) {
  return apiFetch(`/api/shortlists/${id}/candidates?candidateId=${encodeURIComponent(candidateId)}`, { method: "DELETE" });
}

// Client-ready profile - see app/api/candidates/[id]/client-profile.
export async function getClientProfile(candidateId, { blind = false, includeConcerns = false, label } = {}) {
  const params = new URLSearchParams();
  if (blind) params.set("blind", "1");
  if (includeConcerns) params.set("concerns", "1");
  if (label) params.set("label", label);
  return apiFetch(`/api/candidates/${candidateId}/client-profile?${params.toString()}`);
}

export async function recordClientProfilePrinted(candidateId, { blind = false } = {}) {
  return apiFetch(`/api/candidates/${candidateId}/client-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blind }),
  });
}

// Open follow-ups (next actions + talent-pool check-ins) - see
// app/api/follow-ups. scope: "mine" (assigned to me) or "all".
export async function getFollowUps(scope = "mine") {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return apiFetch(`/api/follow-ups?scope=${scope}&tz=${encodeURIComponent(tz)}`);
}

// Clients and contacts - see app/api/clients.
export async function getClients() {
  const res = await apiFetch("/api/clients");
  return res.clients;
}

export async function getClient(id) {
  return apiFetch(`/api/clients/${id}`);
}

export async function createClient(fields) {
  const res = await apiFetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.client;
}

export async function updateClient(id, fields) {
  const res = await apiFetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.client;
}

export async function deleteClient(id) {
  return apiFetch(`/api/clients/${id}`, { method: "DELETE" });
}

export async function addClientContact(clientId, fields) {
  const res = await apiFetch(`/api/clients/${clientId}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.contact;
}

export async function updateClientContact(clientId, contactId, fields) {
  const res = await apiFetch(`/api/clients/${clientId}/contacts`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId, ...fields }),
  });
  return res.contact;
}

export async function removeClientContact(clientId, contactId) {
  return apiFetch(`/api/clients/${clientId}/contacts?contactId=${encodeURIComponent(contactId)}`, { method: "DELETE" });
}

export async function logClientActivity(clientId, type, note) {
  return apiFetch(`/api/clients/${clientId}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
}

// Interviews and scorecards - see app/api/interviews.
export async function getInterviews(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const res = await apiFetch(`/api/interviews?${params.toString()}`);
  return res.interviews;
}

export async function getInterview(id) {
  const res = await apiFetch(`/api/interviews/${id}`);
  return res.interview;
}

export async function scheduleInterview(fields) {
  return apiFetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function updateInterview(id, fields) {
  return apiFetch(`/api/interviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function submitScorecard(interviewId, fields) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "submit", ...fields }),
  });
}

export async function requestScorecard(interviewId, { reviewerName, reviewerEmail, send }) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "request", reviewerName, reviewerEmail, send }),
  });
}

export async function deleteScorecard(interviewId, scorecardId) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards?scorecardId=${encodeURIComponent(scorecardId)}`, { method: "DELETE" });
}

// Email templates, sending, threads and sequences - see app/api/email-*.
export async function getEmailTemplates() {
  return apiFetch("/api/email-templates");
}

export async function saveEmailTemplate(id, fields) {
  const res = await apiFetch(id ? `/api/email-templates/${id}` : "/api/email-templates", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.template;
}

export async function deleteEmailTemplate(id) {
  return apiFetch(`/api/email-templates/${id}`, { method: "DELETE" });
}

export async function sendCandidateEmails({ candidateIds, subject, body, templateId, preview = false }) {
  return apiFetch("/api/emails/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, subject, body, templateId, preview }),
  });
}

export async function getCandidateEmails(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/emails`);
}

export async function getEmailSequences() {
  const res = await apiFetch("/api/email-sequences");
  return res.sequences;
}

export async function saveEmailSequence(id, fields) {
  const res = await apiFetch(id ? `/api/email-sequences/${id}` : "/api/email-sequences", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.sequence;
}

export async function deleteEmailSequence(id) {
  return apiFetch(`/api/email-sequences/${id}`, { method: "DELETE" });
}

export async function enrollInSequence(sequenceId, candidateIds) {
  return apiFetch(`/api/email-sequences/${sequenceId}/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
}

export async function stopEnrollment(enrollmentId) {
  return apiFetch(`/api/sequence-enrollments/${enrollmentId}`, { method: "DELETE" });
}

// The agency's public jobs page settings - see app/api/careers.
export async function getCareersSettings() {
  return apiFetch("/api/careers");
}

export async function saveCareersSettings(fields) {
  return apiFetch("/api/careers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Client review links for a shortlist - see app/api/shortlists/[id]/shares.
export async function getShortlistShares(shortlistId) {
  const res = await apiFetch(`/api/shortlists/${shortlistId}/shares`);
  return res.shares;
}

export async function createShortlistShare(shortlistId, options) {
  return apiFetch(`/api/shortlists/${shortlistId}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export async function revokeShortlistShare(shortlistId, shareId) {
  return apiFetch(`/api/shortlists/${shortlistId}/shares?shareId=${encodeURIComponent(shareId)}`, { method: "DELETE" });
}

// Saved Candidates searches - see app/api/saved-searches.
export async function getSavedSearches({ counts = false } = {}) {
  const res = await apiFetch(`/api/saved-searches${counts ? "?counts=1" : ""}`);
  return res.searches;
}

export async function saveSearch(fields) {
  const res = await apiFetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.search;
}

export async function updateSavedSearch(id, fields) {
  const res = await apiFetch(`/api/saved-searches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.search;
}

export async function deleteSavedSearch(id) {
  return apiFetch(`/api/saved-searches/${id}`, { method: "DELETE" });
}
