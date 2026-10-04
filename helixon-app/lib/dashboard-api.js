"use client";

// Thin fetch wrappers the dashboard and analyse pages use to reach the real
// API routes (app/api/candidates, jobs, team, analytics/timing ...). Each
// throws an Error carrying the server's message on a non-2xx response,
// except where a caller needs the status itself (getTeamSeatUsage). Stage
// values come from lib/stage-labels.js.

import { STAGE_LABELS } from "@/lib/stage-labels";
import { track } from "@/lib/analytics";

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
    // lib/job-details.js - owner falls back to whoever created the job.
    ownerId: j.owner_id || j.user_id || null,
    openings: j.openings ?? null,
    feePercent: j.fee_percent == null ? null : Number(j.fee_percent),
    feeAmount: j.fee_amount == null ? null : Number(j.fee_amount),
    priority: j.priority ?? null,
    targetDate: j.target_date ?? null,
    officeId: j.office_id ?? null,
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
  track("job_created", { source: "manual" });
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
  const result = await apiFetch("/api/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  track("teammate_invited");
  return result;
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

// subStage (optional): one of the agency's sub-stages (lib/custom-fields.js),
// or null to clear it.
export async function updateCandidateStage(id, newStage, subStage) {
  return apiFetch(`/api/candidates/${id}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subStage === undefined ? { stage: newStage } : { stage: newStage || undefined, subStage }),
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
  // keepalive: an undoable removal may be sent as the page closes.
  return apiFetch(`/api/candidates/${id}/talent-pool`, { method: "DELETE", keepalive: true });
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

// keepalive: an undoable delete may be sent as the page closes.
export async function deleteCandidateNote(id, noteId) {
  return apiFetch(`/api/candidates/${id}/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE", keepalive: true });
}

export async function pinCandidateNote(id, noteId, pinned) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, pinned }),
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

// Analytics page filters -> query string for both analytics endpoints.
//   { period: "all" | "30d" | "90d" | "365d" | "custom", from, to
//     (YYYY-MM-DD, custom only), jobId, recruiterId, clientId }
export function analyticsQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  for (const key of ["jobId", "recruiterId", "clientId", "officeId"]) {
    if (filters[key] && filters[key] !== "all") params.set(key, filters[key]);
  }
  return params.toString();
}

// Speed/efficiency, outreach, sourcing, financial, retention and feedback
// figures (app/api/analytics/timing). Fails soft: a broken or slow timing
// query shouldn't blank out the rest of the Analytics page, which has real
// value without it.
async function getTimingSnapshot(filters = {}) {
  try {
    const data = await apiFetch(`/api/analytics/timing?${analyticsQuery(filters)}`);
    if (!data.ok) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * getAnalyticsSnapshot - the Analytics page's numbers. The headline
 * figures (funnel, conversion, quality, pipeline, score calibration, team,
 * trends and changes vs the previous period) are worked out server-side by
 * app/api/analytics/snapshot from the stage-change history; the rest come
 * from app/api/analytics/timing.
 */
export async function getAnalyticsSnapshot(filters = {}) {
  const [snapshot, timing] = await Promise.all([
    apiFetch(`/api/analytics/snapshot?${analyticsQuery(filters)}`),
    getTimingSnapshot(filters),
  ]);
  if (!snapshot?.ok) throw new Error(snapshot?.error || "Failed to load analytics");
  return { ...snapshot, timing };
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
  const share = await apiFetch(`/api/shortlists/${shortlistId}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  track("shortlist_shared");
  return share;
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

// Offers, placements, invoices and timesheets - see app/api/placements,
// app/api/invoices and app/api/invoicing-settings.
const jsonBody = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function getPlacements(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const res = await apiFetch(`/api/placements?${params.toString()}`);
  // Carried on the array so callers keep using it as a list.
  const list = res.placements;
  list.financialsHidden = Boolean(res.financialsHidden);
  return list;
}

export async function getPlacement(id) {
  return apiFetch(`/api/placements/${id}`);
}

export async function createPlacement(fields) {
  const res = await apiFetch("/api/placements", jsonBody("POST", fields));
  return res.placement;
}

export async function updatePlacement(id, fields) {
  const res = await apiFetch(`/api/placements/${id}`, jsonBody("PATCH", fields));
  return res.placement;
}

export async function deletePlacement(id) {
  return apiFetch(`/api/placements/${id}`, { method: "DELETE" });
}

export async function saveTimesheet(placementId, fields) {
  return apiFetch(`/api/placements/${placementId}/timesheets`, jsonBody("POST", fields));
}

export async function reviewTimesheet(placementId, timesheetId, status) {
  return apiFetch(`/api/placements/${placementId}/timesheets`, jsonBody("PATCH", { timesheetId, status }));
}

export async function deleteTimesheet(placementId, timesheetId) {
  return apiFetch(`/api/placements/${placementId}/timesheets?timesheetId=${encodeURIComponent(timesheetId)}`, { method: "DELETE" });
}

export async function raiseInvoice(placementId, fields = {}) {
  const res = await apiFetch(`/api/placements/${placementId}/invoice`, jsonBody("POST", fields));
  return res.invoice;
}

export async function getInvoices(status) {
  const res = await apiFetch(`/api/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  return res.invoices;
}

export async function getInvoice(id) {
  return apiFetch(`/api/invoices/${id}`);
}

export async function updateInvoice(id, fields) {
  const res = await apiFetch(`/api/invoices/${id}`, jsonBody("PATCH", fields));
  return res.invoice;
}

export async function getInvoicingSettings() {
  return apiFetch("/api/invoicing-settings");
}

export async function saveInvoicingSettings(fields) {
  return apiFetch("/api/invoicing-settings", jsonBody("PATCH", fields));
}

// The agency's sub-stages and custom fields - see app/api/customisation.
// Read by many cards on one page, so fetched once per page load (and
// refreshed after saving).
let customisationPromise = null;
export function getCustomisation({ fresh = false } = {}) {
  if (fresh || !customisationPromise) {
    customisationPromise = apiFetch("/api/customisation").catch((err) => {
      customisationPromise = null;
      throw err;
    });
  }
  return customisationPromise;
}

export async function saveCustomisation(fields) {
  const res = await apiFetch("/api/customisation", jsonBody("PUT", fields));
  customisationPromise = Promise.resolve(res);
  return res;
}

export async function setCustomFieldValues(entity, id, values) {
  const res = await apiFetch("/api/custom-fields", jsonBody("PATCH", { entity, id, values }));
  return res.values;
}

// Compliance: checks, references, privacy notices - see
// app/api/candidates/[id]/compliance, references, privacy-notice and
// app/api/compliance.
export async function getCandidateCompliance(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/compliance`);
}

// `fields` as cleanCheck in lib/compliance.js reads them; `file` optional.
function checkRequest(method, fields, file) {
  if (!file) return jsonBody(method, fields);
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.set(k, String(v));
  form.set("document", file);
  return { method, body: form };
}

export async function addComplianceCheck(candidateId, fields, file) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance`, checkRequest("POST", fields, file));
  return res.check;
}

export async function updateComplianceCheck(candidateId, checkId, fields, file) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`, checkRequest("PATCH", fields, file));
  return res.check;
}

export async function deleteComplianceCheck(candidateId, checkId) {
  return apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`, { method: "DELETE" });
}

export async function complianceDocumentLink(candidateId, checkId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`);
  return res.url;
}

export async function requestReference(candidateId, fields) {
  return apiFetch(`/api/candidates/${candidateId}/references`, jsonBody("POST", fields));
}

export async function getReferenceLink(candidateId, refId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/references/${refId}`);
  return res.link;
}

export async function updateReference(candidateId, refId, fields) {
  const res = await apiFetch(`/api/candidates/${candidateId}/references/${refId}`, jsonBody("PATCH", fields));
  return res.reference;
}

export async function deleteReference(candidateId, refId) {
  return apiFetch(`/api/candidates/${candidateId}/references/${refId}`, { method: "DELETE" });
}

// action: "send" | "consent" (with source) | "withdraw"
export async function privacyNoticeAction(candidateId, action, extra = {}) {
  return apiFetch(`/api/candidates/${candidateId}/privacy-notice`, jsonBody("POST", { action, ...extra }));
}

export async function getComplianceOverview() {
  return apiFetch("/api/compliance");
}

export async function sendPrivacyNoticesTo(candidateIds) {
  return apiFetch("/api/compliance", jsonBody("POST", { candidateIds }));
}

// Performance, targets and commission - see app/api/performance.
export async function getPerformance(period) {
  return apiFetch(`/api/performance?period=${encodeURIComponent(period || "this_month")}`);
}

export async function getPerformanceSettings() {
  return apiFetch("/api/performance/settings");
}

export async function savePerformanceSettings(fields) {
  return apiFetch("/api/performance/settings", jsonBody("PUT", fields));
}

// API keys and webhooks - see app/api/integrations.
export async function getApiKeys() {
  const res = await apiFetch("/api/integrations/keys");
  return res.keys;
}

export async function createApiKey(name) {
  return apiFetch("/api/integrations/keys", jsonBody("POST", { name }));
}

export async function revokeApiKey(id) {
  return apiFetch(`/api/integrations/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getWebhooks() {
  return apiFetch("/api/integrations/webhooks");
}

export async function addWebhook(fields) {
  const res = await apiFetch("/api/integrations/webhooks", jsonBody("POST", fields));
  return res.endpoint;
}

export async function updateWebhook(id, fields) {
  return apiFetch("/api/integrations/webhooks", jsonBody("PATCH", { id, ...fields }));
}

export async function deleteWebhook(id) {
  return apiFetch(`/api/integrations/webhooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Business development - app/api/opportunities, lib/opportunities.js.
export async function getOpportunities({ clientId } = {}) {
  const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  return apiFetch(`/api/opportunities${q}`);
}

export async function createOpportunity(fields) {
  const res = await apiFetch("/api/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.opportunity;
}

export async function updateOpportunity(id, fields) {
  const res = await apiFetch(`/api/opportunities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.opportunity;
}

export async function deleteOpportunity(id) {
  return apiFetch(`/api/opportunities/${id}`, { method: "DELETE" });
}

// A follow-up on a client: { label, dueAt } to set, { completed: true } when done.
export async function setClientNextAction(clientId, body) {
  const res = await apiFetch(`/api/clients/${clientId}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.nextAction;
}

// E-signatures - app/api/signatures, lib/signatures.js.
export async function getSignatureRequests({ clientId, candidateId } = {}) {
  const q = new URLSearchParams();
  if (clientId) q.set("clientId", clientId);
  if (candidateId) q.set("candidateId", candidateId);
  return apiFetch(`/api/signatures?${q.toString()}`);
}

export async function getSignatureRequest(id) {
  const res = await apiFetch(`/api/signatures/${id}`);
  return res.request;
}

// Resolves { request, link, emailError }.
export async function createSignatureRequest(fields) {
  return apiFetch("/api/signatures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function voidSignatureRequest(id) {
  return apiFetch(`/api/signatures/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ void: true }),
  });
}

// Candidate self-service link, interview booking links and merging -
// app/api/candidates/[id]/portal-link, booking-links, merge.
export async function getPortalLink(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`);
}

export async function createPortalLink(candidateId, { send = false } = {}) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ send }),
  });
}

export async function revokePortalLink(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`, { method: "DELETE" });
}

export async function getBookingLinks(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links`);
}

export async function createBookingLink(candidateId, fields) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function cancelBookingLink(candidateId, linkId) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links?linkId=${encodeURIComponent(linkId)}`, { method: "DELETE" });
}

export async function mergeCandidate(candidateId, otherId) {
  return apiFetch(`/api/candidates/${candidateId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherId }),
  });
}

// Invoices for Xero / QuickBooks, or a payroll sheet - app/api/exports/accounting.
export async function getAccountingExport(format, { from, to } = {}) {
  const q = new URLSearchParams({ format });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await apiFetch(`/api/exports/accounting?${q.toString()}`);
  return res.rows;
}

// AI call notes - app/api/candidates/[id]/call-notes. Resolves { result, saved }.
export async function summariseCallNotes(candidateId, { notes, kind = "call", save = false }) {
  return apiFetch(`/api/candidates/${candidateId}/call-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, kind, save }),
  });
}

// Texts with a candidate - app/api/candidates/[id]/sms (Twilio).
// Resolves { configured, phone, messages }.
export async function getCandidateSms(id) {
  return apiFetch(`/api/candidates/${id}/sms`);
}

export async function sendCandidateSms(id, body) {
  return (
    await apiFetch(`/api/candidates/${id}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
  ).message;
}

// Connected services - app/api/integrations/connections (Xero, QuickBooks,
// your Gmail / Outlook). Connecting is a full-page visit to
// /api/integrations/oauth/<provider>/connect.
export async function getConnections() {
  return apiFetch("/api/integrations/connections");
}

export async function disconnectIntegration(provider) {
  return apiFetch(`/api/integrations/connections?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
}

export async function syncIntegration(provider) {
  return apiFetch("/api/integrations/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync", provider }),
  });
}

// Sends an invoice to the connected Xero / QuickBooks, or checks whether
// it's been paid there. Resolves { provider, externalId, status, pushed, label }.
export async function syncInvoiceToAccounts(id) {
  return apiFetch(`/api/invoices/${id}/accounting`, { method: "POST" });
}
