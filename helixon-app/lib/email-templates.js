// Validating and shaping email templates (app/api/email-templates).

import { cleanLine, cleanText } from "@/lib/sanitize";

export function cleanTemplate(body = {}, { partial = false } = {}) {
  const out = {};
  if (body.name !== undefined || !partial) {
    out.name = cleanLine(body.name, 120);
    if (!out.name) return { error: "Name the template." };
  }
  if (body.subject !== undefined || !partial) {
    out.subject = cleanLine(body.subject, 300);
    if (!out.subject) return { error: "Add a subject." };
  }
  if (body.body !== undefined || !partial) {
    out.body = cleanText(body.body, { max: 20000 });
    if (!out.body) return { error: "Write the email." };
  }
  if (body.audience !== undefined) {
    if (!["candidate", "client"].includes(body.audience)) return { error: "Unknown audience." };
    out.audience = body.audience;
  }
  return out;
}

export function toTemplate(row) {
  return { id: row.id, name: row.name, audience: row.audience, subject: row.subject, body: row.body, uses: row.uses, updatedAt: row.updated_at };
}
