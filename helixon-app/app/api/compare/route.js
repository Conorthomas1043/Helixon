import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

// GET /api/compare?ids=a,b,c&jobId=j
//
// Side-by-side data for 2-4 saved candidates, from each one's stored
// analysis (scores.result - the full scoring output, not the trimmed shape
// /api/run returns to the browser). With jobId, the analysis against that
// role is used, and `pool` lists the role's other scored candidates so the
// page can offer them. Without it, the role of the first candidate's
// latest analysis is used. Everything is scoped to the caller's agency.

const MAX_COMPARE = 4;
const MAX_POOL = 100;

function displayName(candidate) {
  return candidate.full_name || candidate.name || "Unnamed candidate";
}

function shapeResult(result = {}) {
  return {
    matchScore: result.match_score ?? null,
    recommendation: result.recommendation || null,
    skillScore: result.skill_score ?? null,
    experienceScore: result.experience_score ?? null,
    industryScore: result.culture_score ?? null,
    achievementScore: result.fit_judgment?.method === "llm_judged" ? result.achievement_score ?? null : null,
    breakdown: result.breakdown || null,
    matchedSkills: result.matched_skills || [],
    missingRequired: result.missing_required || result.missing_skills || [],
    missingPreferred: result.missing_preferred || [],
    skillCredit: result.skill_credit || [],
    semanticMatches: result.semantic_matches || [],
    requirementsMet: result.requirements_met || [],
    strengths: result.strengths || [],
    weaknesses: result.weaknesses || [],
    redFlags: result.red_flags || [],
    standout: result.standout_factors || [],
    relevantYears: result.relevant_years_experience ?? null,
    career: result.career_progression?.progression || null,
    rationale: {
      industry: result.fit_judgment?.industry_relevance?.rationale || null,
      career: result.fit_judgment?.career_trajectory?.rationale || null,
      achievements: result.fit_judgment?.achievement_quality?.rationale || null,
      experience: result.fit_judgment?.relevant_experience?.rationale || null,
    },
    salary: result.salary_estimate || null,
    blind: result.blind_mode === true,
  };
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE);
  let jobId = url.searchParams.get("jobId") || null;

  let candidates = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, full_name, name, current_title, current_company, location, stage, job_id, cv_file_url, extracted")
      .in("id", ids)
      .eq("agency_id", agencyId);
    if (error) return NextResponse.json({ error: "Failed to load candidates." }, { status: 500 });
    // Keep the order the ids were asked for.
    candidates = ids.map((id) => (data || []).find((c) => c.id === id)).filter(Boolean);
  }

  const { data: scoreRows, error: scoresError } = ids.length
    ? await supabase
        .from("scores")
        .select("candidate_id, job_id, result, created_at")
        .in("candidate_id", candidates.map((c) => c.id))
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (scoresError) return NextResponse.json({ error: "Failed to load analyses." }, { status: 500 });

  const latestFor = (candidateId, forJob) =>
    (scoreRows || []).find((s) => s.candidate_id === candidateId && (!forJob || s.job_id === forJob)) ||
    (scoreRows || []).find((s) => s.candidate_id === candidateId);

  if (!jobId && candidates.length) {
    jobId = latestFor(candidates[0].id)?.job_id || candidates[0].job_id || null;
  }

  let job = null;
  if (jobId) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id, title, client, parsed")
      .eq("id", jobId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Failed to load the role." }, { status: 500 });
    if (data) {
      const parsed = data.parsed || {};
      job = {
        id: data.id,
        title: data.title,
        client: data.client,
        requiredSkills: parsed.required_skills || [],
        preferredSkills: parsed.preferred_skills || [],
        skillImportance: parsed.skill_importance || {},
        minYears: parsed.min_years_experience || 0,
      };
    } else {
      jobId = null;
    }
  }

  const shaped = candidates.map((c) => {
    const score = latestFor(c.id, jobId);
    const result = shapeResult(score?.result || {});
    return {
      id: c.id,
      name: displayName(c),
      currentTitle: c.current_title || null,
      currentCompany: c.current_company || null,
      location: c.location || null,
      stage: c.stage || null,
      totalYears: c.extracted?.years_experience ?? null,
      hasCv: Boolean(c.cv_file_url),
      analysedAt: score?.created_at || null,
      // Scored against a different role than the one being compared on -
      // the page flags it, since the numbers aren't like-for-like.
      otherRole: Boolean(jobId && score && score.job_id !== jobId),
      analysed: Boolean(score),
      ...result,
    };
  });

  // The role's other scored candidates, for the "add a candidate" picker.
  let pool = [];
  if (jobId) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, full_name, name, match_score, stage, current_title")
      .eq("agency_id", agencyId)
      .eq("job_id", jobId)
      .not("match_score", "is", null)
      .order("match_score", { ascending: false })
      .limit(MAX_POOL);
    if (error) return NextResponse.json({ error: "Failed to load the role's candidates." }, { status: 500 });

    const poolIds = (data || []).map((c) => c.id);
    const { data: poolScores } = poolIds.length
      ? await supabase
          .from("scores")
          .select("candidate_id, result->blind_mode")
          .in("candidate_id", poolIds)
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
      : { data: [] };
    const blindById = new Map();
    for (const s of poolScores || []) {
      if (!blindById.has(s.candidate_id)) blindById.set(s.candidate_id, s.blind_mode === true);
    }

    pool = (data || []).map((c) => ({
      id: c.id,
      name: displayName(c),
      currentTitle: c.current_title || null,
      score: c.match_score,
      stage: c.stage || null,
      blind: blindById.get(c.id) === true,
    }));
  }

  return NextResponse.json({ job, candidates: shaped, pool, max: MAX_COMPARE });
}
