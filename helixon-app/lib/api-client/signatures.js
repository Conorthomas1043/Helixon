"use client";

// Dashboard API calls: signatures (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";


// E-signatures - app/api/signatures, lib/clients/signatures.js.
/** @param {{ clientId?: string, candidateId?: string }} [filters] */
export async function getSignatureRequests({ clientId, candidateId } = {}) {
  const q = new URLSearchParams();
  if (clientId) q.set("clientId", clientId);
  if (candidateId) q.set("candidateId", candidateId);
  return apiFetch(`/api/signatures?${q.toString()}`);
}

/** @param {string} id */
export async function getSignatureRequest(id) {
  const res = await apiFetch(`/api/signatures/${id}`);
  return res.request;
}

// Resolves { request, link, emailError }.
/** @param {import("./core").Fields} fields */
export async function createSignatureRequest(fields) {
  return apiFetch("/api/signatures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

/** @param {string} id */
export async function voidSignatureRequest(id) {
  return apiFetch(`/api/signatures/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ void: true }),
  });
}

// Candidate self-service link, interview booking links and merging -
// app/api/candidates/[id]/portal-link, booking-links, merge.
/** @param {string} candidateId */
export async function getPortalLink(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`);
}

/** @param {string} candidateId @param {{ send?: boolean }} [options] */
export async function createPortalLink(candidateId, { send = false } = {}) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ send }),
  });
}

/** @param {string} candidateId */
export async function revokePortalLink(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/portal-link`, { method: "DELETE" });
}
