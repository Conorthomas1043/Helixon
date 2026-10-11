"use client";

// Dashboard API calls: compliance (re-exported by lib/dashboard-api.js).

import { apiFetch, jsonBody } from "./core";


// Compliance: checks, references, privacy notices - see
// app/api/candidates/[id]/compliance, references, privacy-notice and
// app/api/compliance.
/** @param {string} candidateId */
export async function getCandidateCompliance(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/compliance`);
}

// `fields` as cleanCheck in lib/compliance/core.js reads them; `file` optional.
/** @param {string} method @param {import("./core").Fields} fields @param {File | null | undefined} file */
export function checkRequest(method, fields, file) {
  if (!file) return jsonBody(method, fields);
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.set(k, String(v));
  form.set("document", file);
  return { method, body: form };
}

/** @param {string} candidateId @param {import("./core").Fields} fields @param {File | null | undefined} file */
export async function addComplianceCheck(candidateId, fields, file) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance`, checkRequest("POST", fields, file));
  return res.check;
}

/** @param {string} candidateId @param {string} checkId @param {import("./core").Fields} fields @param {File | null | undefined} file */
export async function updateComplianceCheck(candidateId, checkId, fields, file) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`, checkRequest("PATCH", fields, file));
  return res.check;
}

/** @param {string} candidateId @param {string} checkId */
export async function deleteComplianceCheck(candidateId, checkId) {
  return apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`, { method: "DELETE" });
}

/** @param {string} candidateId @param {string} checkId */
export async function complianceDocumentLink(candidateId, checkId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/compliance/${checkId}`);
  return res.url;
}

/** @param {string} candidateId @param {import("./core").Fields} fields */
export async function requestReference(candidateId, fields) {
  return apiFetch(`/api/candidates/${candidateId}/references`, jsonBody("POST", fields));
}

/** @param {string} candidateId @param {string} refId */
export async function getReferenceLink(candidateId, refId) {
  const res = await apiFetch(`/api/candidates/${candidateId}/references/${refId}`);
  return res.link;
}

/** @param {string} candidateId @param {string} refId @param {import("./core").Fields} fields */
export async function updateReference(candidateId, refId, fields) {
  const res = await apiFetch(`/api/candidates/${candidateId}/references/${refId}`, jsonBody("PATCH", fields));
  return res.reference;
}

/** @param {string} candidateId @param {string} refId */
export async function deleteReference(candidateId, refId) {
  return apiFetch(`/api/candidates/${candidateId}/references/${refId}`, { method: "DELETE" });
}

// action: "send" | "consent" (with source) | "withdraw"
/** @param {string} candidateId @param {string} action @param {import("./core").Fields} [extra] */
export async function privacyNoticeAction(candidateId, action, extra = {}) {
  return apiFetch(`/api/candidates/${candidateId}/privacy-notice`, jsonBody("POST", { action, ...extra }));
}

export async function getComplianceOverview() {
  return apiFetch("/api/compliance");
}

/** @param {string[]} candidateIds */
export async function sendPrivacyNoticesTo(candidateIds) {
  return apiFetch("/api/compliance", jsonBody("POST", { candidateIds }));
}
