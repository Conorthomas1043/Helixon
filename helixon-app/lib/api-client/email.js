"use client";

// Dashboard API calls: email (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";


// Email templates, sending, threads and sequences - see app/api/email-*.
export async function getEmailTemplates() {
  return apiFetch("/api/email-templates");
}

/** @param {string | null | undefined} id @param {import("./core").Fields} fields */
export async function saveEmailTemplate(id, fields) {
  const res = await apiFetch(id ? `/api/email-templates/${id}` : "/api/email-templates", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.template;
}

/** @param {string} id */
export async function deleteEmailTemplate(id) {
  return apiFetch(`/api/email-templates/${id}`, { method: "DELETE" });
}

/** @param {{ candidateIds: string[], subject?: string, body?: string, templateId?: string | null, preview?: boolean }} message */
export async function sendCandidateEmails({ candidateIds, subject, body, templateId, preview = false }) {
  return apiFetch("/api/emails/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, subject, body, templateId, preview }),
  });
}

/** @param {string} candidateId */
export async function getCandidateEmails(candidateId) {
  return apiFetch(`/api/candidates/${candidateId}/emails`);
}

export async function getEmailSequences() {
  const res = await apiFetch("/api/email-sequences");
  return res.sequences;
}

/** @param {string | null | undefined} id @param {import("./core").Fields} fields */
export async function saveEmailSequence(id, fields) {
  const res = await apiFetch(id ? `/api/email-sequences/${id}` : "/api/email-sequences", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.sequence;
}

/** @param {string} id */
export async function deleteEmailSequence(id) {
  return apiFetch(`/api/email-sequences/${id}`, { method: "DELETE" });
}

/** @param {string} sequenceId @param {string[]} candidateIds */
export async function enrollInSequence(sequenceId, candidateIds) {
  return apiFetch(`/api/email-sequences/${sequenceId}/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
}

/** @param {string} enrollmentId */
export async function stopEnrollment(enrollmentId) {
  return apiFetch(`/api/sequence-enrollments/${enrollmentId}`, { method: "DELETE" });
}

// Texts with a candidate - app/api/candidates/[id]/sms (Twilio).
// Resolves { configured, phone, messages }.
/** @param {string} id */
export async function getCandidateSms(id) {
  return apiFetch(`/api/candidates/${id}/sms`);
}

/** @param {string} id @param {string} body */
export async function sendCandidateSms(id, body) {
  return (
    await apiFetch(`/api/candidates/${id}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
  ).message;
}
