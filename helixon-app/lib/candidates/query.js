// The Candidates list filters, shared by app/api/candidates (the list,
// exports, board) and saved-search alerts (app/api/cron/saved-searches),
// so a saved search always means the same thing.
//
// Filters (all optional), as the URL query of /dashboard/candidates:
//   search      plain text -> substring match on the person, their job and
//               recruiter (lib/candidates/search.js); with boolean syntax
//               (AND / OR / NOT, "phrases", brackets, prefix*) -> full-text
//               search of their CV and profile (lib/boolean-search.js)
//   near, radius   within ~radius miles of a UK place or postcode
//               (lib/geocode.js) - candidates whose location couldn't be
//               placed are left out
//   stage, status, recruiterId, jobId, scoreBand, dateRange, tagIds, pool

import "server-only";
import { supabase } from "@/lib/supabase";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { buildCandidateSearchFilter, cleanSearchTerm, likePattern, matchingRecruiterIds, quoted } from "@/lib/candidates/search";
import { booleanToTsquery, looksBoolean } from "@/lib/boolean-search";
import { boundingBox, geocode } from "@/lib/geocode";

export const RADIUS_CHOICES = [5, 10, 25, 50, 100];

// Plain-object filters from URLSearchParams (or a saved search's params).
export function readFilters(params) {
  const get = (k) => (typeof params.get === "function" ? params.get(k) : params[k]) ?? null;
  const radius = Number(get("radius"));
  return {
    search: cleanSearchTerm(get("search")),
    near: String(get("near") || "").trim().slice(0, 100),
    radius: RADIUS_CHOICES.includes(radius) ? radius : 25,
    stage: get("stage") || "all",
    status: get("status") || "all",
    recruiterId: get("recruiterId") || "all",
    jobId: get("jobId") || "all",
    scoreBand: get("scoreBand") || "all",
    dateRange: get("dateRange") || "all",
    // "tags" is how the Candidates page writes it in its own URL.
    tagIds: String(get("tagIds") || get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
    pool: get("pool") === "1" || get("pool") === true,
  };
}

// Looks up what the filters need from elsewhere: job/recruiter ids for a
// plain search, the tsquery for a boolean one, the box for a radius.
// { resolved } or { error } (e.g. a place that couldn't be found).
export async function resolveFilters(agencyId, filters) {
  const resolved = { ...filters, jobIds: [], recruiterIds: [], tsquery: null, box: null, center: null };
  if (filters.search && looksBoolean(filters.search)) {
    resolved.tsquery = booleanToTsquery(filters.search);
    if (!resolved.tsquery) return { error: "That search needs at least one word to look for." };
  } else if (filters.search) {
    const pattern = likePattern(filters.search);
    const [{ data: jobRows }, { data: team }] = await Promise.all([
      supabase.from("jobs").select("id").eq("agency_id", agencyId).or(`title.ilike.${quoted(pattern)},client.ilike.${quoted(pattern)}`).limit(200),
      supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", agencyId),
    ]);
    resolved.jobIds = (jobRows ?? []).map((j) => j.id);
    resolved.recruiterIds = matchingRecruiterIds((team ?? []).map((p) => ({ id: p.clerk_user_id, name: recruiterDisplayName(p) })), filters.search);
  }
  if (filters.near) {
    const center = await geocode(filters.near);
    if (!center) return { error: `Couldn't find "${filters.near}" - try a UK town or postcode.` };
    resolved.center = center;
    resolved.box = boundingBox(center, filters.radius);
  }
  return { resolved };
}

// Applies resolved filters to a candidates query. broadSearch=false falls
// back to a name-only search (used if the combined filter is ever refused).
export function applyFilters(query, r, { broadSearch = true } = {}) {
  let q = query;
  if (r.stage !== "all") q = q.eq("stage", r.stage);
  if (r.status !== "all") q = q.eq("processing_status", r.status);
  if (r.recruiterId !== "all") q = q.eq("recruiter_id", r.recruiterId);
  if (r.jobId !== "all") q = q.eq("job_id", r.jobId);
  if (r.tsquery) {
    q = q.textSearch("search_vector", r.tsquery, { config: "english" });
  } else if (r.search) {
    q = broadSearch ? q.or(buildCandidateSearchFilter(r.search, { jobIds: r.jobIds, recruiterIds: r.recruiterIds })) : q.ilike("full_name", likePattern(r.search));
  }
  if (r.box) {
    q = q.gte("lat", r.box.minLat).lte("lat", r.box.maxLat).gte("lng", r.box.minLng).lte("lng", r.box.maxLng);
  }
  if (r.tagIds.length > 0) q = q.contains("tags", r.tagIds);
  if (r.pool) q = q.not("talent_pool_at", "is", null);
  if (r.scoreBand === "80+") q = q.gte("match_score", 80);
  else if (r.scoreBand === "60-79") q = q.gte("match_score", 60).lt("match_score", 80);
  else if (r.scoreBand === "<60") q = q.lt("match_score", 60);
  if (r.dateRange !== "all") {
    const days = { today: 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[r.dateRange];
    if (days) q = q.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
  }
  return q;
}
