"use client";

// Dashboard API calls: candidates (re-exported by lib/dashboard-api.js).

import { shapeCandidate } from "@/lib/candidates/shape";
import { apiFetch } from "./core";
import { buildCandidatesQuery } from "@/lib/candidates/list-params";

/** @typedef {import("@/lib/candidates/list-params").CandidateQuery} CandidateQuery */
/** @typedef {import("@/lib/contracts/candidates").CandidateListItem} CandidateListItem */
/** @typedef {import("@/lib/contracts/candidates").CandidateListPage} CandidateListPage */
/** @typedef {import("@/lib/contracts/candidates").StageCounts} StageCounts */
/** @typedef {import("@/lib/contracts/candidates").CandidateProfile} CandidateProfile */
/** @typedef {import("@/lib/contracts/candidates").ShapedCandidateProfile} ShapedCandidateProfile */

export { buildCandidatesQuery };

/** @param {CandidateQuery} [query] @returns {Promise<CandidateListPage>} */
export async function getCandidates(query = {}) {
  return apiFetch(`/api/candidates?${buildCandidatesQuery(query).toString()}`);
}

// The API caps pageSize at 200 (app/api/candidates/route.js), so callers
// that need "every matching candidate" (analytics, pipeline board,
// CSV export) page through the whole result using totalPages from each
// real response. 200 per page keeps a large agency to a handful of
// requests (5,000 candidates is 25 sequential requests).
// Capped at 100 pages (20,000 candidates) against a runaway loop.
/** @param {CandidateQuery} [query] @returns {Promise<CandidateListItem[]>} */
export async function getAllCandidates(query = {}) {
  const { page: _page, pageSize: _pageSize, ...rest } = query;
  /** @type {CandidateListItem[]} */
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

// Candidates per stage for the current filters (the stage tabs), counted
// on the server in one request rather than by fetching every candidate.
/** @param {CandidateQuery} [query] @returns {Promise<StageCounts>} */
export async function getStageCounts(query = {}) {
  return apiFetch(`/api/candidates/stage-counts?${buildCandidatesQuery(query).toString()}`);
}

// Every candidate for the pipeline board, paging through the API's
// 200-row limit (see getAllCandidates).
/** @param {CandidateQuery} [query] */
export async function getPipelineCandidates(query = {}) {
  return getAllCandidates(query);
}

// Real, unpaginated candidate export - CSV download on the Candidates page.
/** @param {CandidateQuery} [query] */
export async function getCandidatesForExport(query = {}) {
  return getAllCandidates(query);
}

/** @param {string} id @returns {Promise<ShapedCandidateProfile>} */
export async function getCandidateById(id) {
  /** @type {CandidateProfile} */
  const candidate = await apiFetch(`/api/candidates/${id}`);
  return shapeCandidate(candidate);
}

// Name, contact details and current role, as corrected by a recruiter - see
// app/api/candidates/[id]/route.js's PATCH.
/** @param {string} id @param {import("./core").Fields} fields */
export async function updateCandidateContact(id, fields) {
  return apiFetch(`/api/candidates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Self-reported fields: source of hire, rejection reason, placement fee/
// cost, 30/90-day retention. See app/api/candidates/[id]/details/route.js.
/** @param {string} id @param {import("./core").Fields} fields */
export async function updateCandidateDetails(id, fields) {
  return apiFetch(`/api/candidates/${id}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Manual outreach logging (call/email/meeting/CV sent) - see
// app/api/candidates/[id]/activity/route.js.
/** @param {string} id @param {string} type @param {string} note */
export async function logCandidateActivity(id, type, note) {
  return apiFetch(`/api/candidates/${id}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
}

// Candidate NPS / hiring-manager feedback requests - see
// app/api/candidates/[id]/feedback-requests/route.js.
/** @param {string} candidateId */
export async function getFeedbackRequests(candidateId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/feedback-requests`);
  return res.requests;
}

// With sendTo the link is also emailed; the result says whether it went
// ({ request, emailedTo, sendError }) - the link exists either way.
/** @param {string} candidateId @param {{ kind: string, recipientLabel?: string, sendTo?: string }} request */
export async function createFeedbackRequest(candidateId, { kind, recipientLabel, sendTo }) {
  return apiFetch(`/api/candidates/${candidateId}/feedback-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, recipientLabel, sendTo: sendTo || undefined }),
  });
}

// Emails an existing, unanswered feedback link.
/** @param {string} candidateId @param {string} requestId @param {string} sendTo */
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
/** @param {string[]} ids @param {import("./core").Fields} payload */
export async function bulkUpdateCandidates(ids, payload) {
  return apiFetch("/api/candidates/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ...payload }),
  });
}

// subStage (optional): one of the agency's sub-stages (lib/agency/custom-fields.js),
// or null to clear it.
/** @param {string} id @param {string} newStage @param {string | null | undefined} subStage */
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
/** @param {string} id @param {{ everyRecord?: boolean }} [options] */
export async function deleteCandidate(id, { everyRecord = false } = {}) {
  return apiFetch(`/api/candidates/${id}${everyRecord ? "?all=1" : ""}`, { method: "DELETE" });
}

/** @param {string} id @param {string | null} recruiterId */
export async function assignCandidate(id, recruiterId) {
  return apiFetch(`/api/candidates/${id}/assignment`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recruiterId }),
  });
}

/** @param {string} id @param {string} body */
export async function addCandidateNote(id, body) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

/** @param {string} id @param {string} noteId @param {string} body */
export async function editCandidateNote(id, noteId, body) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, body }),
  });
}

// keepalive: an undoable delete may be sent as the page closes.
/** @param {string} id @param {string} noteId */
export async function deleteCandidateNote(id, noteId) {
  return apiFetch(`/api/candidates/${id}/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE", keepalive: true });
}

/** @param {string} id @param {string} noteId @param {boolean} pinned */
export async function pinCandidateNote(id, noteId, pinned) {
  return apiFetch(`/api/candidates/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, pinned }),
  });
}

/** @param {string} id @param {{ label: string, dueAt?: string | null }} action */
export async function setCandidateNextAction(id, { label, dueAt }) {
  return apiFetch(`/api/candidates/${id}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, dueAt }),
  });
}

/** @param {string} id */
export async function completeNextAction(id) {
  return apiFetch(`/api/candidates/${id}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
}

// Client-ready profile - see app/api/candidates/[id]/client-profile.
/** @param {string} candidateId @param {{ blind?: boolean, includeConcerns?: boolean, label?: string }} [options] */
export async function getClientProfile(candidateId, { blind = false, includeConcerns = false, label } = {}) {
  const params = new URLSearchParams();
  if (blind) params.set("blind", "1");
  if (includeConcerns) params.set("concerns", "1");
  if (label) params.set("label", label);
  return apiFetch(`/api/candidates/${candidateId}/client-profile?${params.toString()}`);
}

/** @param {string} candidateId @param {{ blind?: boolean }} [options] */
export async function recordClientProfilePrinted(candidateId, { blind = false } = {}) {
  return apiFetch(`/api/candidates/${candidateId}/client-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blind }),
  });
}

/** @param {string} candidateId @param {string} otherId */
export async function mergeCandidate(candidateId, otherId) {
  return apiFetch(`/api/candidates/${candidateId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherId }),
  });
}

// AI call notes - app/api/candidates/[id]/call-notes. Resolves { result, saved }.
/** @param {string} candidateId @param {{ notes: string, kind?: string, save?: boolean }} request */
export async function summariseCallNotes(candidateId, { notes, kind = "call", save = false }) {
  return apiFetch(`/api/candidates/${candidateId}/call-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, kind, save }),
  });
}
