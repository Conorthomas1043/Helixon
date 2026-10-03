// A job's ownership and commercial details (migration 20261003000000):
// who owns it, how many hires, the agreed fee, priority and target date.

export const JOB_PRIORITIES = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Columns from a request body - only keys present are returned.
// { error } on invalid input.
export function cleanJobDetails(body = {}) {
  const out = {};
  if (body.ownerId !== undefined) {
    if (body.ownerId !== null && (typeof body.ownerId !== "string" || !/^[\w-]{1,64}$/.test(body.ownerId))) return { error: "Unknown owner." };
    out.owner_id = body.ownerId || null;
  }
  if (body.openings !== undefined) {
    if (body.openings === null || body.openings === "") out.openings = null;
    else {
      const n = Number(body.openings);
      if (!Number.isInteger(n) || n < 1 || n > 1000) return { error: "Openings must be a whole number from 1 to 1000." };
      out.openings = n;
    }
  }
  for (const [key, col, max, label] of [
    ["feePercent", "fee_percent", 100, "Fee % must be between 0 and 100."],
    ["feeAmount", "fee_amount", 1e9, "Fee must be a positive amount."],
  ]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      out[col] = null;
      continue;
    }
    const n = Number(String(body[key]).replace(/[£$€,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > max) return { error: label };
    out[col] = Math.round(n * 100) / 100;
  }
  if (body.priority !== undefined) {
    if (body.priority !== null && body.priority !== "" && !JOB_PRIORITIES[body.priority]) return { error: "Unknown priority." };
    out.priority = body.priority || null;
  }
  if (body.targetDate !== undefined) {
    if (body.targetDate && (!DATE_RE.test(body.targetDate) || Number.isNaN(Date.parse(body.targetDate)))) return { error: "Target date isn't a date." };
    out.target_date = body.targetDate || null;
  }
  return out;
}

// Who a job belongs to: its owner, or whoever created it.
export function jobOwnerId(job) {
  return job?.owner_id || job?.ownerId || job?.user_id || null;
}

// Sort helper: urgent first, unset counts as normal.
export function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.normal;
}

// Days until (negative: since) a job's target date, from `now`.
export function daysToTarget(targetDate, now = Date.now()) {
  if (!targetDate || !DATE_RE.test(String(targetDate).slice(0, 10))) return null;
  const target = Date.parse(`${String(targetDate).slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}
