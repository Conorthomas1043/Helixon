import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidate-query";
import { distanceMiles } from "@/lib/geocode";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";

// Rebuilt against Clerk auth and scoped to the caller's agency_id - the
// previous version authenticated via a Supabase-Auth bearer token nothing
// in this Clerk-based app ever sends (getCurrentRecruiter always threw,
// see lib/supabase/server.js), and had no agency scoping at all, so a
// working version of it would have returned every agency's candidates to
// anyone. See app/api/dashboard-stats/route.js for the same Clerk +
// agency_id pattern this mirrors.
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

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const params = new URL(request.url).searchParams;
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
  if (filterError) return NextResponse.json({ error: filterError }, { status: 400 });

  // skills:extracted->skills pulls just that key - selecting the whole
  // parsed-CV `extracted` JSON per row made every list/board load heavy.
  const COLUMNS =
    "id, full_name, name, current_title, current_company, location, processing_status, stage, match_score, tags, next_action, recruiter_id, job_id, created_at, last_activity_at, talent_pool_at, pooled_from_id, source, skills:extracted->skills, jobs(id, title, client)";
  // lat/lng (search migration) and sub_stage (custom stages migration):
  // until those are applied the list still loads (42703 = undefined
  // column), just without distances and sub-stages.
  let withGeo = true;
  const build = (broadSearch) => {
    let query = supabase
      .from("candidates")
      .select(withGeo ? `${COLUMNS}, lat, lng, sub_stage` : COLUMNS, { count: "exact" })
      .eq("agency_id", agencyId);
    query = applyFilters(query, resolved, { broadSearch });
    query = scopeCandidateQuery(query, access, auth);

    const sort = SORTS[sortBy] ?? SORTS.score_desc;
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

    const from = (page - 1) * pageSize;
    return query.range(from, from + pageSize - 1);
  };

  let { data, count, error } = await build(true);
  if (error?.code === "42703" && !resolved.box && !resolved.tsquery) {
    withGeo = false;
    ({ data, count, error } = await build(true));
  }
  // If the combined search is ever rejected, still answer with the
  // name-only search rather than an error.
  if (error && filters.search && !resolved.tsquery) ({ data, count, error } = await build(false));
  if (error) {
    return NextResponse.json({ error: resolved.tsquery ? "That search couldn't be run - check the brackets and quotes." : "Failed to load candidates" }, { status: resolved.tsquery ? 400 : 500 });
  }

  const recruiterNames = await resolveRecruiterNames(supabase, (data ?? []).map((c) => c.recruiter_id));

  // A row screened from someone already on file is in the pool when that
  // person is.
  const rootIds = [...new Set((data ?? []).map((c) => c.pooled_from_id).filter(Boolean))];
  const pooledRoots = new Set();
  if (rootIds.length) {
    const { data: roots } = await supabase
      .from("candidates")
      .select("id")
      .eq("agency_id", agencyId)
      .in("id", rootIds)
      .not("talent_pool_at", "is", null);
    for (const r of roots ?? []) pooledRoots.add(r.id);
  }

  return NextResponse.json({
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
  });
}
