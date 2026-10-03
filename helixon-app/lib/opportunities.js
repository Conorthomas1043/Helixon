// Business development: deals with clients and prospects
// (client_opportunities, migration 20261003000000). Pure helpers so the
// pipeline maths is tested on its own.

import { cleanLine, cleanText } from "@/lib/sanitize";

export const OPPORTUNITY_STAGES = {
  lead: "Lead",
  contacted: "Contacted",
  meeting: "Meeting booked",
  proposal: "Terms sent",
  won: "Won",
  lost: "Lost",
};
export const OPEN_STAGES = ["lead", "contacted", "meeting", "proposal"];

// Typical chance of winning at each stage, used when no probability is set.
export const DEFAULT_PROBABILITY = { lead: 10, contacted: 20, meeting: 40, proposal: 60, won: 100, lost: 0 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Columns from a request body - only keys present are returned.
// { error } on invalid input.
export function cleanOpportunity(body = {}, { requireTitle = false } = {}) {
  const out = {};
  if (body.title !== undefined || requireTitle) {
    const title = cleanLine(body.title, 200);
    if (!title) return { error: "Give the deal a name." };
    out.title = title;
  }
  if (body.stage !== undefined) {
    if (!OPPORTUNITY_STAGES[body.stage]) return { error: "Unknown stage." };
    out.stage = body.stage;
  }
  if (body.value !== undefined) {
    if (body.value === null || body.value === "") out.value = null;
    else {
      const n = Number(String(body.value).replace(/[£$€,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 1e10) return { error: "Value must be a positive amount." };
      out.value = Math.round(n * 100) / 100;
    }
  }
  if (body.probability !== undefined) {
    if (body.probability === null || body.probability === "") out.probability = null;
    else {
      const n = Number(body.probability);
      if (!Number.isInteger(n) || n < 0 || n > 100) return { error: "Probability is a whole percentage, 0 to 100." };
      out.probability = n;
    }
  }
  if (body.expectedClose !== undefined) {
    if (body.expectedClose && (!DATE_RE.test(body.expectedClose) || Number.isNaN(Date.parse(body.expectedClose)))) return { error: "Expected close isn't a date." };
    out.expected_close = body.expectedClose || null;
  }
  if (body.ownerId !== undefined) {
    if (body.ownerId !== null && (typeof body.ownerId !== "string" || !/^[\w-]{1,64}$/.test(body.ownerId))) return { error: "Unknown owner." };
    out.owner_id = body.ownerId || null;
  }
  if (body.notes !== undefined) out.notes = cleanText(body.notes, { max: 4000 }) || null;
  if (body.lostReason !== undefined) out.lost_reason = cleanLine(body.lostReason, 500) || null;
  return out;
}

export function toOpportunity(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? row.client_name ?? null,
    contactId: row.contact_id,
    jobId: row.job_id,
    title: row.title,
    stage: row.stage,
    value: row.value == null ? null : Number(row.value),
    probability: row.probability,
    expectedClose: row.expected_close,
    ownerId: row.owner_id,
    notes: row.notes,
    lostReason: row.lost_reason,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function effectiveProbability(o) {
  return o.probability ?? DEFAULT_PROBABILITY[o.stage] ?? 0;
}

// Pipeline totals: open value, weighted (value x probability), and won /
// lost since `since` (a Date, e.g. the start of the month).
export function pipelineSummary(opportunities, since = null) {
  const open = opportunities.filter((o) => OPEN_STAGES.includes(o.stage));
  const closedSince = (o) => !since || (o.closedAt && new Date(o.closedAt) >= since);
  const won = opportunities.filter((o) => o.stage === "won" && closedSince(o));
  const lost = opportunities.filter((o) => o.stage === "lost" && closedSince(o));
  const sum = (list, f) => Math.round(list.reduce((n, o) => n + f(o), 0) * 100) / 100;
  return {
    openCount: open.length,
    openValue: sum(open, (o) => o.value || 0),
    weightedValue: sum(open, (o) => ((o.value || 0) * effectiveProbability(o)) / 100),
    wonCount: won.length,
    wonValue: sum(won, (o) => o.value || 0),
    lostCount: lost.length,
    winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
    byStage: Object.fromEntries(
      Object.keys(OPPORTUNITY_STAGES).map((s) => {
        const list = opportunities.filter((o) => o.stage === s);
        return [s, { count: list.length, value: sum(list, (o) => o.value || 0) }];
      })
    ),
  };
}

// A follow-up on a client ({ label, dueAt }), validated. { error } if not.
export function cleanNextAction(body = {}) {
  const label = cleanLine(body.label, 200);
  if (!label) return { error: "Say what the follow-up is." };
  let dueAt = null;
  if (body.dueAt != null && body.dueAt !== "") {
    const due = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
    if (!due || Number.isNaN(due.getTime())) return { error: "That due date isn't a date." };
    dueAt = due.toISOString();
  }
  return { nextAction: { label, dueAt, completed: false } };
}
