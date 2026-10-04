"use client";

// Dashboard API calls: compliance (re-exported by lib/dashboard-api.js).

import { apiFetch, jsonBody } from "./core";

// Compliance: checks, references, privacy notices - see
// app/api/candidates/[id]/compliance, references, privacy-notice and
// app/api/compliance.
export async function getCandidateCompliance(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/compliance`);
}

// `fields` as cleanCheck in lib/compliance.js reads them; `file` optional.
export function checkRequest(method, fields, file) {
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
