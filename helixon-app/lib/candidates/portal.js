// Candidate self-service (candidate_portal_links, migration 20261003010000):
// a private link where a candidate keeps their own details current and
// uploads documents. Pure helpers for what they may change.

import { cleanLine } from "@/lib/sanitize";

export const PORTAL_LINK_DAYS = 30;

// What a candidate can edit about themselves: request key -> column.
export const PORTAL_FIELDS = {
  phone: { column: "phone", max: 40, label: "Phone" },
  location: { column: "location", max: 120, label: "Location" },
  currentTitle: { column: "current_title", max: 160, label: "Current job title" },
  currentCompany: { column: "current_company", max: 160, label: "Current employer" },
  linkedin: { column: "linkedin", max: 200, label: "LinkedIn" },
  noticePeriod: { column: "notice_period", max: 100, label: "Notice period" },
  salaryExpectation: { column: "salary_expectation", max: 100, label: "Salary expectation" },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Columns to update from what the candidate sent, plus the labels of what
// changed (for the timeline). { error } on invalid input.
export function cleanPortalUpdate(body = {}, current = {}) {
  const update = {};
  const changed = [];
  for (const [key, f] of Object.entries(PORTAL_FIELDS)) {
    if (body[key] === undefined) continue;
    const value = cleanLine(body[key], f.max) || null;
    if (value !== (current[f.column] ?? null)) {
      update[f.column] = value;
      changed.push(f.label);
    }
  }
  if (body.availableFrom !== undefined) {
    const v = body.availableFrom || null;
    if (v && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) return { error: "Available from isn't a date." };
    if (v !== (current.available_from ?? null)) {
      update.available_from = v;
      changed.push("Available from");
    }
  }
  return { update, changed };
}

export function portalView(candidate) {
  const out = {};
  for (const [key, f] of Object.entries(PORTAL_FIELDS)) out[key] = candidate[f.column] ?? "";
  out.availableFrom = candidate.available_from ?? "";
  return out;
}
