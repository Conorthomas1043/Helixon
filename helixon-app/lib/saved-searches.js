// Saved Candidates searches ("smart lists") - see migration
// 20261001050000. params are the Candidates page's own URL filters
// (lib/candidate-query.js); only the known keys are kept.

import { cleanLine } from "@/lib/sanitize";

const KEYS = ["search", "near", "radius", "stage", "status", "recruiterId", "jobId", "scoreBand", "dateRange", "tagIds", "tags", "pool", "sortBy"];

export function cleanParams(params) {
  const out = {};
  if (!params || typeof params !== "object") return out;
  for (const k of KEYS) {
    const v = params[k];
    if (v === undefined || v === null || v === "" || v === "all") continue;
    out[k] = String(v).slice(0, 300);
  }
  return out;
}

export function cleanSavedSearch(body = {}, { partial = false } = {}) {
  const out = {};
  if (body.name !== undefined || !partial) {
    out.name = cleanLine(body.name, 120);
    if (!out.name) return { error: "Name the search." };
  }
  if (body.params !== undefined || !partial) out.params = cleanParams(body.params);
  if (body.shared !== undefined) out.shared = body.shared === true;
  if (body.alert !== undefined) out.alert = body.alert === true;
  return out;
}

export function toSavedSearch(row, userId) {
  return {
    id: row.id,
    name: row.name,
    params: row.params || {},
    shared: row.shared,
    alert: row.alert,
    mine: row.user_id === userId,
    createdAt: row.created_at,
  };
}

// "/dashboard/candidates?..." for a saved search.
export function searchHref(params) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return `/dashboard/candidates${qs ? `?${qs}` : ""}`;
}
