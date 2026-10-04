"use client";

// Dashboard API calls: candidates (re-exported by lib/dashboard-api.js).

import { STAGE_LABELS } from "@/lib/stage-labels";
import { shapeCandidate } from "@/lib/candidate-shape";
import { apiFetch } from "./core";

export function buildCandidatesQuery(query = {}) {
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
export async function getAllCandidates(query = {}) {
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
  return shapeCandidate(await apiFetch(`/api/candidates/${id}`));
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

export async function mergeCandidate(candidateId, otherId) {
  return apiFetch(`/api/candidates/${candidateId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherId }),
  });
}

// AI call notes - app/api/candidates/[id]/call-notes. Resolves { result, saved }.
export async function summariseCallNotes(candidateId, { notes, kind = "call", save = false }) {
  return apiFetch(`/api/candidates/${candidateId}/call-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, kind, save }),
  });
}
