import "server-only";

// The candidate list (/dashboard/candidates), shared by GET /api/candidates
// and the page itself, which loads its first page on the server. Both take
// the API's query string (see buildCandidatesQuery in
// lib/candidate-list-params.js) and return { status, body }.

import { supabase } from "@/lib/supabase";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidate-query";
import { distanceMiles } from "@/lib/geocode";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";
import { STAGE_LABELS } from "@/lib/stage-labels";

// ?sortBy= choices.
const SORTS = {
  score_desc: { column: "match_score", ascending: false },
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  recent_activity: { column: "last_activity_at", ascending: false },
  // Alphabetical on the raw stage string, not funnel order - ordering by a
  // joined/computed rank isn't supported by a single .order() call here.
  // "recruiter"/"job" (sort-by-joined-table-name) aren't supported for the
  // same reason and fall back to score_desc below.
  stage: { column: "stage", ascending: false },
};

/**
 * One page of the agency's candidates matching the filters in `params`.
 * @param {{ agencyId: string, userId: string, profile?: any }} auth a signed-in member
 * @param {URLSearchParams} params
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function listCandidates(auth, params) {
  const db = await agencyDb();
  const { agencyId } = auth;

  // Every filter (search, boolean search, radius, stage ...) lives in
  // lib/candidate-query.js, shared with saved-search alerts.
  const filters = readFilters(params);
  const sortBy = params.get("sortBy") ?? "score_desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  // Up to 200 so "load everything" callers (analytics, export) need few requests.
  const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize")) || 8));

  const { resolved, error: filterError } = await resolveFilters(agencyId, filters);
  // "Own candidates only" (lib/permissions.js) narrows every list.
  const access = await getAccess(auth);
  if (filterError) return { status: 400, body: { error: filterError } };

  // skills:extracted->skills pulls just that key - selecting the whole
  // parsed-CV `extracted` JSON per row made every list/board load heavy.
  const COLUMNS =
    "id, full_name, name, current_title, current_company, location, processing_status, stage, sub_stage, match_score, tags, next_action, recruiter_id, job_id, created_at, last_activity_at, talent_pool_at, pooled_from_id, source, lat, lng, skills:extracted->skills, jobs(id, title, client)";
  const build = (broadSearch) => {
    let query = db
      .from("candidates")
      .select(COLUMNS, { count: "exact" })
      .eq("agency_id", agencyId);
    query = applyFilters(query, resolved, { broadSearch });
    query = scopeCandidateQuery(query, access, auth);

    const sort = SORTS[sortBy] ?? SORTS.score_desc;
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

    const from = (page - 1) * pageSize;
    return query.range(from, from + pageSize - 1);
  };

  let { data, count, error } = await build(true);
  // If the combined search is ever rejected, still answer with the
  // name-only search rather than an error.
  if (error && filters.search && !resolved.tsquery) ({ data, count, error } = await build(false));
  if (error) {
    return resolved.tsquery
      ? { status: 400, body: { error: "That search couldn't be run - check the brackets and quotes." } }
      : { status: 500, body: { error: "Failed to load candidates" } };
  }

  const recruiterNames = await resolveRecruiterNames(supabase, (data ?? []).map((c) => c.recruiter_id));

  // A row screened from someone already on file is in the pool when that
  // person is.
  const rootIds = [...new Set((data ?? []).map((c) => c.pooled_from_id).filter(Boolean))];
  const pooledRoots = new Set();
  if (rootIds.length) {
    const { data: roots } = await db
      .from("candidates")
      .select("id")
      .eq("agency_id", agencyId)
      .in("id", rootIds)
      .not("talent_pool_at", "is", null);
    for (const r of roots ?? []) pooledRoots.add(r.id);
  }

  return {
    status: 200,
    body: {
      items: (data ?? []).map((c) => ({
        id: c.id,
        fullName: c.full_name || c.name || "Unnamed candidate",
        currentTitle: c.current_title,
        currentCompany: c.current_company,
        location: c.location,
        jobId: c.job_id,
        jobTitle: c.jobs?.title || "Unspecified role",
        company: c.jobs?.client ?? null,
        recruiterId: c.recruiter_id,
        recruiterName: recruiterNames.get(c.recruiter_id) ?? null,
        status: c.processing_status,
        stage: c.stage,
        subStage: c.sub_stage ?? null,
        score: c.match_score,
        skills: Array.isArray(c.skills) ? c.skills : [],
        tags: c.tags ?? [],
        nextAction: c.next_action,
        createdAt: c.created_at,
        lastActivityAt: c.last_activity_at,
        inTalentPool: Boolean(c.talent_pool_at) || pooledRoots.has(c.pooled_from_id),
        source: c.source ?? null,
        distanceMiles: resolved.center && c.lat != null ? Math.round(distanceMiles(resolved.center, { lat: c.lat, lng: c.lng })) : null,
      })),
      total: count ?? 0,
      searchMode: resolved.tsquery ? "boolean" : filters.search ? "text" : null,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    },
  };
}

const COUNT_BATCH = 1000;
// Against a runaway loop, as in lib/dashboard-stats.js.
const COUNT_CAP = 20000;

/**
 * How many candidates match the filters in `params` at each stage, ignoring
 * the stage filter itself (the counts label the stage tabs). One stage
 * column per row, paged in batches of 1,000 (the database's row limit per
 * request).
 * @param {{ agencyId: string, userId: string, profile?: any }} auth a signed-in member
 * @param {URLSearchParams} params
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function countCandidateStages(auth, params) {
  const db = await agencyDb();
  const { agencyId } = auth;
  const filters = { ...readFilters(params), stage: "all" };
  const { resolved, error: filterError } = await resolveFilters(agencyId, filters);
  if (filterError) return { status: 400, body: { error: filterError } };
  const access = await getAccess(auth);

  const counts = { all: 0 };
  for (const stage of Object.keys(STAGE_LABELS)) counts[stage] = 0;
  for (let from = 0; from < COUNT_CAP; from += COUNT_BATCH) {
    let query = db.from("candidates").select("stage").eq("agency_id", agencyId);
    query = applyFilters(query, resolved, { broadSearch: true });
    query = scopeCandidateQuery(query, access, auth);
    const { data, error } = await query.order("id").range(from, from + COUNT_BATCH - 1);
    if (error) {
      return resolved.tsquery
        ? { status: 400, body: { error: "That search couldn't be run - check the brackets and quotes." } }
        : { status: 500, body: { error: "Failed to count candidates" } };
    }
    for (const row of data ?? []) {
      counts.all += 1;
      if (row.stage in counts) counts[row.stage] += 1;
    }
    if (!data || data.length < COUNT_BATCH) break;
  }
  return { status: 200, body: counts };
}
