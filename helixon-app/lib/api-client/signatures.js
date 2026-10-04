"use client";

// Dashboard API calls: signatures (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

// E-signatures - app/api/signatures, lib/signatures.js.
/** @param {{ clientId?: string, candidateId?: string }} [filters] */
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
