// The candidate list's filters, shared by the page (client) and its server
// loader: reading them from the address bar, writing them back, and turning
// them into GET /api/candidates's query string. No "use client" or
// "server-only" here, so both sides can import it.

/**
 * The list's filters as the page holds them.
 * @typedef {{
 *   search: string, near: string, radius: string, stage: string, scoreBand: string, status: string,
 *   recruiterId: string, jobId: string, tagIds: string[], pool: boolean, dateRange: string, sortBy: string, page: number,
 * }} CandidateFilters
 */

/**
 * What buildCandidatesQuery reads: any of the filters, plus a page size.
 * @typedef {Partial<Omit<CandidateFilters, "radius" | "page">> & { radius?: string | number, page?: number, pageSize?: number }} CandidateQuery
 */

/** @typedef {"search" | "near" | "radius" | "stage" | "scoreBand" | "status" | "recruiterId" | "jobId" | "dateRange" | "sortBy"} ListKey */

/** @type {CandidateFilters} */
export const DEFAULT_FILTERS = {
  search: "",
  near: "",
  radius: "25",
  stage: "all",
  scoreBand: "all",
  status: "all",
  recruiterId: "all",
  jobId: "all",
  tagIds: [],
  pool: false,
  dateRange: "all",
  sortBy: "score_desc",
  page: 1,
};

// Filters <-> query string. Only values that differ from the defaults are
// written, so a plain list stays at /dashboard/candidates.
/** @type {ListKey[]} */
export const LIST_KEYS = ["search", "near", "radius", "stage", "scoreBand", "status", "recruiterId", "jobId", "dateRange", "sortBy"];

/** @param {URLSearchParams | { get(key: string): string | null } | null | undefined} params @returns {CandidateFilters} */
export function filtersFromParams(params) {
  const f = { ...DEFAULT_FILTERS };
  for (const key of LIST_KEYS) {
    const v = params?.get(key);
    if (v) f[key] = v;
  }
  const tags = params?.get("tags");
  if (tags) f.tagIds = tags.split(",").filter(Boolean);
  if (params?.get("pool") === "1") f.pool = true;
  const page = Number(params?.get("page"));
  if (Number.isInteger(page) && page > 1) f.page = page;
  return f;
}

/** @param {CandidateFilters} f */
export function paramsFromFilters(f) {
  const q = new URLSearchParams();
  for (const key of LIST_KEYS) {
    if (key === "radius" && !f.near) continue;
    if (f[key] && f[key] !== DEFAULT_FILTERS[key]) q.set(key, f[key]);
  }
  if (f.tagIds.length) q.set("tags", f.tagIds.join(","));
  if (f.pool) q.set("pool", "1");
  if (f.page > 1) q.set("page", String(f.page));
  return q.toString();
}

// The API query string for a set of filters.
/** @param {CandidateQuery} [query] */
export function buildCandidatesQuery(query = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.near) {
    params.set("near", query.near);
    params.set("radius", String(query.radius || 25));
  }
  if (query.stage && query.stage !== "all") params.set("stage", query.stage);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.recruiterId && query.recruiterId !== "all") params.set("recruiterId", query.recruiterId);
  if (query.jobId && query.jobId !== "all") params.set("jobId", query.jobId);
  if (query.scoreBand && query.scoreBand !== "all") params.set("scoreBand", query.scoreBand);
  if (query.dateRange && query.dateRange !== "all") params.set("dateRange", query.dateRange);
  if (query.pool) params.set("pool", "1");
  if (query.tagIds && query.tagIds.length > 0) params.set("tagIds", query.tagIds.join(","));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  params.set("page", String(query.page || 1));
  params.set("pageSize", String(query.pageSize || 8));
  return params;
}
