"use client";

// Dashboard API calls: shortlists (re-exported by lib/dashboard-api.js).

import { track } from "@/lib/analytics/track";
import { apiFetch } from "./core";


// Shortlists - see app/api/shortlists. `candidateId` marks which lists
// already have that person on them (containsCandidate).
/** @param {{ jobId?: string, candidateId?: string }} [filters] */
export async function getShortlists({ jobId, candidateId } = {}) {
  const params = new URLSearchParams();
  if (jobId) params.set("jobId", jobId);
  if (candidateId) params.set("candidateId", candidateId);
  const res = await apiFetch(`/api/shortlists?${params.toString()}`);
  return res.shortlists;
}

/** @param {{ name: string, jobId?: string | null, candidateIds?: string[] }} shortlist */
export async function createShortlist({ name, jobId = null, candidateIds = [] }) {
  const res = await apiFetch("/api/shortlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, jobId, candidateIds }),
  });
  return res.shortlist;
}

/** @param {string} id */
export async function getShortlist(id) {
  return apiFetch(`/api/shortlists/${id}`);
}

/** @param {string} id @param {import("./core").Fields} fields */
export async function updateShortlist(id, fields) {
  const res = await apiFetch(`/api/shortlists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.shortlist;
}

/** @param {string} id */
export async function deleteShortlist(id) {
  return apiFetch(`/api/shortlists/${id}`, { method: "DELETE" });
}

/** @param {string} id @param {string[]} candidateIds @param {string | null} [note] */
export async function addToShortlist(id, candidateIds, note = null) {
  return apiFetch(`/api/shortlists/${id}/candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, note }),
  });
}

/** @param {string} id @param {string} candidateId @param {string} note */
export async function setShortlistNote(id, candidateId, note) {
  return apiFetch(`/api/shortlists/${id}/candidates`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, note }),
  });
}

/** @param {string} id @param {string} candidateId */
export async function removeFromShortlist(id, candidateId) {
  return apiFetch(`/api/shortlists/${id}/candidates?candidateId=${encodeURIComponent(candidateId)}`, { method: "DELETE" });
}

// Client review links for a shortlist - see app/api/shortlists/[id]/shares.
/** @param {string} shortlistId */
export async function getShortlistShares(shortlistId) {
  const res = await apiFetch(`/api/shortlists/${shortlistId}/shares`);
  return res.shares;
}

/** @param {string} shortlistId @param {import("./core").Fields} options */
export async function createShortlistShare(shortlistId, options) {
  const share = await apiFetch(`/api/shortlists/${shortlistId}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  track("shortlist_shared");
  return share;
}

/** @param {string} shortlistId @param {string} shareId */
export async function revokeShortlistShare(shortlistId, shareId) {
  return apiFetch(`/api/shortlists/${shortlistId}/shares?shareId=${encodeURIComponent(shareId)}`, { method: "DELETE" });
}
