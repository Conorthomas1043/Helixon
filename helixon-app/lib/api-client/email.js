"use client";

// Dashboard API calls: email (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

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
