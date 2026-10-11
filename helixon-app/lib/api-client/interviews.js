"use client";

// Dashboard API calls: interviews (re-exported by lib/dashboard-api.js).

import { track } from "@/lib/analytics";
import { apiFetch } from "./core";


// Interviews and scorecards - see app/api/interviews.
/** @param {Record<string, string | undefined>} [query] */
export async function getInterviews(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const res = await apiFetch(`/api/interviews?${params.toString()}`);
  return res.interviews;
}

/** @param {string} id */
export async function getInterview(id) {
  const res = await apiFetch(`/api/interviews/${id}`);
  return res.interview;
}

/** @param {import("./core").Fields} fields */
export async function scheduleInterview(fields) {
  const interview = await apiFetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  track("interview_scheduled");
  return interview;
}

/** @param {string} id @param {import("./core").Fields} fields */
export async function updateInterview(id, fields) {
  return apiFetch(`/api/interviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

/** @param {string} interviewId @param {import("./core").Fields} fields */
export async function submitScorecard(interviewId, fields) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "submit", ...fields }),
  });
}

/** @param {string} interviewId @param {{ reviewerName?: string, reviewerEmail?: string, send?: boolean }} reviewer */
export async function requestScorecard(interviewId, { reviewerName, reviewerEmail, send }) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "request", reviewerName, reviewerEmail, send }),
  });
}

/** @param {string} interviewId @param {string} scorecardId */
export async function deleteScorecard(interviewId, scorecardId) {
  return apiFetch(`/api/interviews/${interviewId}/scorecards?scorecardId=${encodeURIComponent(scorecardId)}`, { method: "DELETE" });
}

/** @param {string} candidateId */
export async function getBookingLinks(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links`);
}

/** @param {string} candidateId @param {import("./core").Fields} fields */
export async function createBookingLink(candidateId, fields) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

/** @param {string} candidateId @param {string} linkId */
export async function cancelBookingLink(candidateId, linkId) {
  return apiFetch(`/api/candidates/${candidateId}/booking-links?linkId=${encodeURIComponent(linkId)}`, { method: "DELETE" });
}
