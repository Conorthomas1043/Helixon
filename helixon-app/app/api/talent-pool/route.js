import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { candidateHaystack, quickFit } from "@/lib/talent-pool-match";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";

// GET ?jobId= - the agency's talent pool: everyone saved for future roles
// (app/api/candidates/[id]/talent-pool), with their availability, check-in
// date and the roles each has been screened for.
//
// Every person is also given a quick keyword fit (lib/talent-pool-match.js)
// against each open job, which gives:
//   - bestMatch: their best open job they haven't been screened for yet
//   - openJobs: each open job with how many likely fits the pool holds
// With a jobId, each gets that job's fit and whether they've already been
// screened for it - the starting point for picking who to screen properly.
// Filtering and sorting happen on the page.
const MAX_POOL = 2000;
const MAX_OPEN_JOBS = 60;
const PAGE = 500;
const CHUNK = 200;
const LIKELY_FIT = 70;
const BEST_MATCH_MIN = 50;

function chunks(list) {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

function requirementsOf(job) {
  return {
    requiredSkills: job.required_skills?.length ? job.required_skills : job.parsed?.required_skills || [],
    preferredSkills: job.preferred_skills?.length ? job.preferred_skills : job.parsed?.preferred_skills || [],
    minYearsExperience: job.min_years_experience ?? job.parsed?.min_years_experience ?? null,
  };
}

function skillNames(raw) {
  return Array.isArray(raw) ? raw.map((s) => (typeof s === "string" ? s : s?.name || "")).filter(Boolean) : [];
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const jobId = cleanUuid(new URL(request.url).searchParams.get("jobId"));

  const JOB_COLUMNS = "id, title, client, status, created_at, required_skills, preferred_skills, min_years_experience, parsed";
  const [{ data: openJobRows, error: jobsError }, { data: selected }] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("agency_id", agencyId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(MAX_OPEN_JOBS),
    jobId
      ? supabase.from("jobs").select(JOB_COLUMNS).eq("id", jobId).eq("agency_id", agencyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (jobsError) {
    return NextResponse.json({ error: "Couldn't load the talent pool." }, { status: 500 });
  }
  if (jobId && !selected) {
    return NextResponse.json({ error: "That job could not be found." }, { status: 404 });
  }

  const access = await getAccess(auth);
  const rows = [];
  for (let from = 0; from < MAX_POOL; from += PAGE) {
    const { data, error } = await scopeCandidateQuery(supabase
      .from("candidates")
      .select(
        "id, full_name, name, current_title, current_company, location, years_experience, job_id, match_score, stage, cv_text, " +
          "talent_pool_at, talent_pool_by, talent_pool_note, talent_pool_status, talent_pool_check_in, talent_pool_expires_at, " +
          "skills:extracted->skills, extracted_years:extracted->years_experience"
      )
      .eq("agency_id", agencyId)
      .not("talent_pool_at", "is", null)
      .order("talent_pool_at", { ascending: false })
      .range(from, from + PAGE - 1), access, auth);
    if (error) {
      console.error("[talent-pool] Load failed:", error.message);
      return NextResponse.json({ error: "Couldn't load the talent pool." }, { status: 500 });
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  // Every role each person has been screened for: their own row plus rows
  // re-screened from it.
  const linked = [];
  for (const ids of chunks(rows.map((r) => r.id))) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, pooled_from_id, job_id, match_score, stage")
      .eq("agency_id", agencyId)
      .in("pooled_from_id", ids);
    if (error) {
      console.error("[talent-pool] Linked rows failed:", error.message);
      return NextResponse.json({ error: "Couldn't load the talent pool." }, { status: 500 });
    }
    linked.push(...(data || []));
  }
  const jobTitles = new Map([...(openJobRows || []), ...(selected ? [selected] : [])].map((j) => [j.id, j.title]));
  const missingTitles = [...new Set([...rows, ...linked].map((r) => r.job_id).filter((id) => id && !jobTitles.has(id)))];
  for (const ids of chunks(missingTitles)) {
    const { data } = await supabase.from("jobs").select("id, title").eq("agency_id", agencyId).in("id", ids);
    for (const j of data || []) jobTitles.set(j.id, j.title);
  }

  const openJobs = (openJobRows || []).map((j) => ({ id: j.id, title: j.title, client: j.client, createdAt: j.created_at, req: requirementsOf(j), likely: 0 }));
  const selectedReq = selected ? requirementsOf(selected) : null;
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = Date.now() - 30 * 86400000;

  const items = rows.map((r) => {
    const skills = skillNames(r.skills);
    const yearsExperience = r.years_experience ?? (Number(r.extracted_years) || null);
    const role = (id, jobIdOf, score, stage) => ({ candidateId: id, jobId: jobIdOf, jobTitle: jobTitles.get(jobIdOf) || "Role", score, stage });
    const roles = [
      ...(r.job_id ? [role(r.id, r.job_id, r.match_score, r.stage)] : []),
      ...linked.filter((l) => l.pooled_from_id === r.id && l.job_id).map((l) => role(l.id, l.job_id, l.match_score, l.stage)),
    ];
    const screenedJobIds = new Set(roles.map((x) => x.jobId));
    const hasCv = Boolean(r.cv_text && r.cv_text.trim());
    const person = { haystack: candidateHaystack({ cvText: r.cv_text, skills, currentTitle: r.current_title }), yearsExperience };

    let bestMatch = null;
    if (hasCv) {
      for (const job of openJobs) {
        if (screenedJobIds.has(job.id)) continue;
        const { fit } = quickFit(job.req, person);
        if (fit == null) continue;
        if (fit >= LIKELY_FIT) job.likely += 1;
        if (fit >= BEST_MATCH_MIN && (!bestMatch || fit > bestMatch.fit)) bestMatch = { jobId: job.id, title: job.title, fit };
      }
    }

    const item = {
      id: r.id,
      name: r.full_name || r.name || "Unnamed candidate",
      currentTitle: r.current_title,
      currentCompany: r.current_company,
      location: r.location,
      yearsExperience,
      skills: skills.slice(0, 20),
      savedAt: r.talent_pool_at,
      savedBy: r.talent_pool_by,
      note: r.talent_pool_note,
      status: r.talent_pool_status,
      checkIn: r.talent_pool_check_in,
      expiresAt: r.talent_pool_expires_at,
      hasCv,
      roles,
      bestMatch,
    };
    if (selected) {
      const fit = quickFit(selectedReq, person);
      Object.assign(item, {
        fit: hasCv ? fit.fit : null,
        matched: fit.matched,
        missing: fit.missing,
        experienceOk: fit.experienceOk,
        screened: roles.find((x) => x.jobId === selected.id) || null,
      });
    }
    return item;
  });

  // Most common skills across the pool, for the skill filter.
  const skillCounts = new Map();
  for (const i of items) {
    for (const sk of new Set(i.skills.map((x) => x.trim()))) {
      const key = sk.toLowerCase();
      const cur = skillCounts.get(key) || { label: sk, count: 0 };
      cur.count += 1;
      skillCounts.set(key, cur);
    }
  }

  return NextResponse.json({
    total: items.length,
    items,
    stats: {
      total: items.length,
      available: items.filter((i) => i.status === "available" || i.status === "open").length,
      checkInsDue: items.filter((i) => i.checkIn && i.checkIn <= today).length,
      addedLast30: items.filter((i) => new Date(i.savedAt).getTime() >= monthAgo).length,
    },
    topSkills: [...skillCounts.values()].sort((a, b) => b.count - a.count).slice(0, 20),
    openJobs: openJobs
      .map(({ req, ...j }) => ({ ...j, requiredSkills: req.requiredSkills }))
      .sort((a, b) => b.likely - a.likely || new Date(b.createdAt) - new Date(a.createdAt)),
    job: selected
      ? { id: selected.id, title: selected.title, client: selected.client, status: selected.status, ...selectedReq }
      : null,
  });
}
