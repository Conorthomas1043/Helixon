// Compliance checks, references and privacy notices - see migration
// 20261001080000. The rules (what counts as expiring, when a privacy notice
// is due, what a referee is asked) live here so the API, the profile card
// and the Compliance page agree.

import { cleanEmail, cleanLine, cleanText } from "@/lib/sanitize";

export const CHECK_KINDS = {
  right_to_work: "Right to work",
  dbs: "DBS check",
  identity: "ID check",
  qualification: "Qualification",
  licence: "Licence / registration",
  other: "Other",
};
export const CHECK_STATUSES = { pending: "To do", verified: "Verified", failed: "Failed" };

// UK right-to-work evidence, as the Home Office guidance lists it.
export const RTW_DOCUMENTS = [
  "Online check (share code)",
  "British / Irish passport",
  "Irish passport card",
  "Birth certificate + NI number",
  "Certificate of registration / naturalisation",
  "Identity Document Validation Technology (IDVT)",
  "Biometric residence permit / card",
  "Other document",
];

export const EXPIRING_DAYS = 30;
export const NOTICE_DUE_DAYS = 30;
const DAY = 86400000;

// Uploads: a scan or photo of the document.
export const DOCUMENT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function documentExtension(name = "", type = "") {
  const ext = String(name).toLowerCase().split(".").pop();
  if (DOCUMENT_TYPES[ext] && (!type || DOCUMENT_TYPES[ext] === type)) return ext;
  return null;
}

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !Number.isNaN(Date.parse(v));

// Check fields from a request body (JSON or form fields), as columns.
// Only keys present are returned. { error } on bad input.
export function cleanCheck(body = {}, { creating = false } = {}) {
  const out = {};
  if (body.kind !== undefined || creating) {
    if (!CHECK_KINDS[body.kind]) return { error: "Pick the kind of check." };
    out.kind = body.kind;
  }
  if (body.status !== undefined) {
    if (!CHECK_STATUSES[body.status]) return { error: "Unknown status." };
    out.status = body.status;
  }
  for (const [key, col] of [
    ["checkedOn", "checked_on"],
    ["expiresOn", "expires_on"],
    ["followUpOn", "follow_up_on"],
  ]) {
    if (body[key] === undefined) continue;
    if (!body[key]) out[col] = null;
    else if (!isDate(body[key])) return { error: "Check the dates." };
    else out[col] = body[key];
  }
  if (body.label !== undefined) out.label = cleanLine(body.label, 120) || null;
  if (body.documentType !== undefined) out.document_type = cleanLine(body.documentType, 120) || null;
  if (body.notes !== undefined) out.notes = cleanText(body.notes, { max: 2000 }) || null;
  if (body.checkedBy !== undefined) out.checked_by = cleanLine(body.checkedBy, 200) || null;
  return out;
}

export function toCheck(row) {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    kind: row.kind,
    label: row.label,
    status: row.status,
    documentType: row.document_type,
    checkedOn: row.checked_on,
    expiresOn: row.expires_on,
    followUpOn: row.follow_up_on,
    notes: row.notes,
    document: row.document_path ? { name: row.document_name || "Document" } : null,
    checkedBy: row.checked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// Where a check stands: "failed", "pending", "expired", "expiring" (within
// EXPIRING_DAYS, or a follow-up check due), or "ok".
export function checkState(check, now = today()) {
  const status = check.status;
  const expires = check.expiresOn ?? check.expires_on;
  const followUp = check.followUpOn ?? check.follow_up_on;
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  if (expires && expires < now) return "expired";
  const soon = plusDays(now, EXPIRING_DAYS);
  if ((expires && expires <= soon) || (followUp && followUp <= soon)) return "expiring";
  return "ok";
}

// Article 14: someone whose details came from somewhere other than
// themselves (a job board, LinkedIn, a referral) must be given the privacy
// notice within a month. People who applied through the jobs page saw it
// when they applied. Returns null (not needed / done), or { dueOn, overdue }.
export function privacyNoticeStatus(candidate, now = today()) {
  const c = candidate;
  if (c.privacy_notice_sent_at || c.consent_given_at) return null;
  if (c.source === "careers_page" || c.consent_source) return null;
  const added = String(c.created_at || "").slice(0, 10);
  if (!added) return null;
  const dueOn = plusDays(added, NOTICE_DUE_DAYS);
  return { dueOn, overdue: dueOn < now };
}

// What a referee is asked (app/reference/[token]).
export const REFERENCE_QUESTIONS = [
  { id: "datesConfirmed", label: "Can you confirm the dates they worked with you?", type: "text", placeholder: "e.g. March 2021 to June 2024" },
  { id: "role", label: "What was their role?", type: "text" },
  { id: "relationship", label: "How did you work with them?", type: "text", placeholder: "e.g. their line manager" },
  { id: "performance", label: "How would you rate their performance overall?", type: "rating" },
  { id: "reliability", label: "How would you rate their reliability and attendance?", type: "rating" },
  { id: "strengths", label: "What are their main strengths?", type: "longtext" },
  { id: "development", label: "Is there anything they could develop?", type: "longtext" },
  { id: "reasonForLeaving", label: "Why did they leave?", type: "text" },
  { id: "rehire", label: "Would you employ them again?", type: "choice", options: ["Yes", "No", "Not sure"] },
  { id: "comments", label: "Anything else we should know?", type: "longtext" },
];

export function cleanReferenceAnswers(body = {}) {
  const answers = {};
  for (const q of REFERENCE_QUESTIONS) {
    const v = body[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (q.type === "rating") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) return { error: "Ratings are 1 to 5." };
      answers[q.id] = n;
    } else if (q.type === "choice") {
      if (!q.options.includes(v)) return { error: "Pick one of the options." };
      answers[q.id] = v;
    } else {
      const text = q.type === "longtext" ? cleanText(v, { max: 3000 }) : cleanLine(v, 300);
      if (text) answers[q.id] = text;
    }
  }
  const name = cleanLine(body.completedBy, 200);
  if (!name) return { error: "Please add your name." };
  if (body.confirm !== true) return { error: "Please confirm the reference is accurate." };
  if (Object.keys(answers).length < 2) return { error: "Please answer at least a couple of the questions." };
  answers.completedBy = name;
  const jobTitle = cleanLine(body.completedByTitle, 200);
  if (jobTitle) answers.completedByTitle = jobTitle;
  return { answers };
}

export function cleanReferee(body = {}) {
  const name = cleanLine(body.refereeName, 200);
  if (!name) return { error: "Add the referee's name." };
  let email = null;
  if (body.refereeEmail) {
    email = cleanEmail(body.refereeEmail);
    if (!email) return { error: "That email address doesn't look right." };
  }
  return {
    referee_name: name,
    referee_email: email,
    referee_phone: cleanLine(body.refereePhone, 40) || null,
    referee_company: cleanLine(body.refereeCompany, 200) || null,
    referee_title: cleanLine(body.refereeTitle, 200) || null,
    relationship: cleanLine(body.relationship, 200) || null,
  };
}

export function toReference(row) {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    refereeName: row.referee_name,
    refereeEmail: row.referee_email,
    refereePhone: row.referee_phone,
    refereeCompany: row.referee_company,
    refereeTitle: row.referee_title,
    relationship: row.relationship,
    status: row.status,
    answers: row.answers,
    requestedAt: row.requested_at,
    receivedAt: row.received_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
