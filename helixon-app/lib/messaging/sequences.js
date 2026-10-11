// Email sequences: a series of steps, each sent `delayDays` after the one
// before (the first counts from enrolment). Sent by app/api/cron/sequences.

import { cleanLine, cleanText } from "@/lib/sanitize";

export const MAX_STEPS = 10;
const DAY = 86400000;

// Validated steps or { error }.
export function cleanSequenceSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return { error: "Add at least one email." };
  if (steps.length > MAX_STEPS) return { error: `Up to ${MAX_STEPS} emails per sequence.` };
  const out = [];
  for (const [i, s] of steps.entries()) {
    const delayDays = Number(s?.delayDays);
    if (!Number.isInteger(delayDays) || delayDays < 0 || delayDays > 90) return { error: `Email ${i + 1}: the wait must be 0–90 days.` };
    const subject = cleanLine(s?.subject, 300);
    const body = cleanText(s?.body, { max: 20000 });
    if (!subject || !body) return { error: `Email ${i + 1} needs a subject and a message.` };
    out.push({ delayDays, subject, body });
  }
  return { steps: out };
}

// When step `index` is due, given when the previous step went (or the
// enrolment started).
export function stepDueAt(steps, index, from = new Date()) {
  const step = steps[index];
  if (!step) return null;
  return new Date(new Date(from).getTime() + step.delayDays * DAY).toISOString();
}

// Why a candidate should leave a sequence before the next email, or null.
export function stopReason(candidate) {
  if (!candidate) return "Candidate removed";
  if (!candidate.email) return "No email address";
  if (candidate.stage === "Rejected") return "Rejected";
  if (candidate.stage === "Placed") return "Placed";
  return null;
}

export function toSequence(row, stats = null) {
  return {
    id: row.id,
    name: row.name,
    steps: Array.isArray(row.steps) ? row.steps : [],
    active: row.active,
    updatedAt: row.updated_at,
    ...(stats ? { stats } : {}),
  };
}
