// E-signatures (signature_requests, migration 20261003010000): a document
// sent to someone to sign on a private link. Pure helpers - validation,
// the hash that pins down exactly what was signed, and starting-point
// wording for the usual documents - so they're tested without a database.

import { createHash, randomBytes } from "crypto";
import { cleanEmail, cleanLine } from "@/lib/sanitize";
import { SIGNATURE_KINDS } from "./signatures-shared";

// The parts the browser needs too (labels, starting-point wording) live in
// signatures-shared.js, which doesn't pull in Node's crypto.
export { SIGNATURE_KINDS, SIGNATURE_STATUSES, offerLetterText, termsOfBusinessText } from "./signatures-shared";

export const TOKEN_RE = /^[a-f0-9]{48}$/;
const MAX_BODY = 60000;

export function newToken() {
  return randomBytes(24).toString("hex");
}

// SHA-256 of exactly what the signer saw - title and body - so a signed
// copy can be shown to be unchanged.
export function documentHash(title, body) {
  return createHash("sha256").update(`${title}\n\n${body}`, "utf8").digest("hex");
}

// A new request from a request body. { error } on invalid input.
export function cleanSignatureRequest(body = {}) {
  const kind = SIGNATURE_KINDS[body.kind] ? body.kind : "other";
  const title = cleanLine(body.title, 200);
  if (!title) return { error: "Give the document a title." };
  const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n").trim() : "";
  if (!text) return { error: "The document is empty." };
  if (text.length > MAX_BODY) return { error: "The document is too long." };
  const signerName = cleanLine(body.signerName, 200);
  if (!signerName) return { error: "Who needs to sign it?" };
  let signerEmail = null;
  if (body.signerEmail) {
    signerEmail = cleanEmail(body.signerEmail);
    if (!signerEmail) return { error: "That email address doesn't look right." };
  }
  const days = Number(body.expiresInDays ?? 30);
  const expiresInDays = Number.isInteger(days) && days >= 1 && days <= 365 ? days : 30;
  return { kind, title, body: text, signerName, signerEmail, expiresInDays };
}

// The signer's answer. { error } if they haven't typed their name or ticked
// the box.
export function cleanSignature(body = {}) {
  if (body.decline === true) return { decline: true, reason: cleanLine(body.reason, 1000) || null };
  const name = cleanLine(body.name, 200);
  if (!name || name.length < 2) return { error: "Type your full name to sign." };
  if (body.agree !== true) return { error: "Tick the box to confirm you agree." };
  return { name };
}

export function toSignatureRequest(row, { includeLink = false, siteUrl = "" } = {}) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    clientId: row.client_id,
    candidateId: row.candidate_id,
    placementId: row.placement_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    status: row.status,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    signedName: row.signed_name,
    declinedReason: row.declined_reason,
    expiresAt: row.expires_at,
    documentHash: row.document_hash,
    createdAt: row.created_at,
    ...(includeLink ? { link: `${siteUrl}/sign/${row.token}` } : {}),
  };
}
