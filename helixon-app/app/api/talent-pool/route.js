import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { quickFit } from "@/lib/talent-pool-match";

// GET ?search=&jobId= - the agency's talent pool: everyone saved for future
// roles (app/api/candidates/[id]/talent-pool), with the roles each has been
// screened for. With a jobId, each is also given a quick keyword fit for
// that job (lib/talent-pool-match.js) and whether they've already been
// screened for it, best fit first - the starting point for picking who to
// screen properly.
const MAX_POOL = 2000;
const PAGE = 500;
const CHUNK = 200;

function chunks(list) {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const params = new URL(request.url).searchParams;
  const search = (params.get("search") || "").trim().toLowerCase().slice(0, 100);
  const jobId = cleanUuid(params.get("jobId"));

  let job = null;
  if (jobId) {
    const { data } = await supabase
      .from("jobs")
      .select("id, title, client, status, required_skills, preferred_skills, min_years_experience, parsed")
      .eq("id", jobId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "That job could not be found." }, { status: 404 });
    job = data;
  }

  const columns = [
    "id, full_name, name, current_title, current_company, location, years_experience, talent_pool_at, talent_pool_by, talent_pool_note, job_id, match_score, stage",
    "skills:extracted->skills, extracted_years:extracted->years_experience",
    ...(job ? ["cv_text"] : []),
  ].join(", ");

  const rows = [];
  for (let from = 0; from < MAX_POOL; from += PAGE) {
    const { data, error } = await supabase
      .from("candidates")
      .select(columns)
      .eq("agency_id", agencyId)
      .not("talent_pool_at", "is", null)
      .order("talent_pool_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[talent-pool] Load failed:", error.message);
      return NextResponse.json({ error: "Couldn't load the talent pool." }, { status: 500 });
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  // Every role each person has been screened for: their own row plus rows
  // re-screened from it.
  const rootIds = rows.map((r) => r.id);
  const linked = [];
  for (const ids of chunks(rootIds)) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, pooled_from_id, job_id, match_score, stage, jobs(title)")
      .eq("agency_id", agencyId)
      .in("pooled_from_id", ids);
    if (error) {
      console.error("[talent-pool] Linked rows failed:", error.message);
      return NextResponse.json({ error: "Couldn't load the talent pool." }, { status: 500 });
    }
    linked.push(...(data || []));
  }
  const jobTitles = new Map();
  const ownJobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))];
  for (const ids of chunks(ownJobIds)) {
    const { data } = await supabase.from("jobs").select("id, title").eq("agency_id", agencyId).in("id", ids);
    for (const j of data || []) jobTitles.set(j.id, j.title);
  }

  const requiredSkills = job ? (job.required_skills?.length ? job.required_skills : job.parsed?.required_skills || []) : [];
  const preferredSkills = job ? (job.preferred_skills?.length ? job.preferred_skills : job.parsed?.preferred_skills || []) : [];
  const minYears = job ? job.min_years_experience ?? job.parsed?.min_years_experience ?? null : null;

  let items = rows.map((r) => {
    const skills = Array.isArray(r.skills) ? r.skills.map((s) => (typeof s === "string" ? s : s?.name || "")).filter(Boolean) : [];
    const yearsExperience = r.years_experience ?? (Number(r.extracted_years) || null);
    const roles = [
      ...(r.job_id ? [{ candidateId: r.id, jobId: r.job_id, jobTitle: jobTitles.get(r.job_id) || "Role", score: r.match_score, stage: r.stage }] : []),
      ...linked
        .filter((l) => l.pooled_from_id === r.id)
        .map((l) => ({ candidateId: l.id, jobId: l.job_id, jobTitle: l.jobs?.title || "Role", score: l.match_score, stage: l.stage })),
    ];
    const item = {
      id: r.id,
      name: r.full_name || r.name || "Unnamed candidate",
      currentTitle: r.current_title,
      currentCompany: r.current_company,
      location: r.location,
      yearsExperience,
      skills: skills.slice(0, 12),
      savedAt: r.talent_pool_at,
      savedBy: r.talent_pool_by,
      note: r.talent_pool_note,
      roles,
    };
    if (job) {
      const fit = quickFit(
        { requiredSkills, preferredSkills, minYearsExperience: minYears },
        { cvText: r.cv_text, skills, yearsExperience, currentTitle: r.current_title }
      );
      const screened = roles.find((role) => role.jobId === job.id) || null;
      Object.assign(item, { hasCv: Boolean(r.cv_text && r.cv_text.trim()), fit: fit.fit, matched: fit.matched, missing: fit.missing, experienceOk: fit.experienceOk, screened });
    }
    item._search = [item.name, item.currentTitle, item.currentCompany, item.location, item.note, ...skills].join(" ").toLowerCase();
    return item;
  });

  const total = items.length;
  if (search) items = items.filter((i) => i._search.includes(search));
  if (job) items.sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
  items = items.map(({ _search, ...rest }) => rest);

  return NextResponse.json({
    total,
    items,
    job: job
      ? {
          id: job.id,
          title: job.title,
          client: job.client,
          status: job.status,
          requiredSkills,
          preferredSkills,
          minYearsExperience: minYears,
        }
      : null,
  });
}
