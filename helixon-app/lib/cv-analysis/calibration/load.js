// Labelled analyses for scoring calibration, read with a service-role
// Supabase client (the admin API and the scripts pass their own). Read-only.
//
// A score is labelled when a recruiter gave it a band (feedback.expected_band,
// latest wins) or, failing that, when it's the candidate's score for the job
// they're in the pipeline for and the pipeline says how it went (see
// labelFor in lib/cv-analysis/calibration).

import { labelFor } from "./index.js";

const PAGE = 1000;

async function all(query) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * [{ scoreId, candidateId, jobId, agencyId, result, roleType, label, source, createdAt }]
 * for every score. `label` is 1, 0 or null; `source` says where it came from.
 * withText adds the stored CV text and job text (for re-scoring).
 */
export async function loadScores(supabase, { withText = false } = {}) {
  const [scores, feedback, candidates, jobs] = await Promise.all([
    all(() => supabase.from("scores").select("id, agency_id, candidate_id, job_id, match_score, result, created_at").order("created_at")),
    all(() => supabase.from("feedback").select("score_id, expected_band, created_at").not("score_id", "is", null).order("created_at")),
    all(() => supabase.from("candidates").select(`id, job_id, stage, rejection_reason${withText ? ", cv_text" : ""}`)),
    all(() => supabase.from("jobs").select(`id, parsed${withText ? ", job_text" : ""}`)),
  ]);
  const bandByScore = new Map();
  for (const f of feedback) if (f.expected_band) bandByScore.set(f.score_id, f.expected_band); // latest wins
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  // The pipeline outcome belongs to the candidate's latest score for the job they're in.
  const latestForPipeline = new Map();
  for (const s of scores) {
    const c = candidateById.get(s.candidate_id);
    if (c && c.job_id === s.job_id) latestForPipeline.set(s.candidate_id, s.id);
  }

  return scores.map((s) => {
    const c = candidateById.get(s.candidate_id) || {};
    const job = jobById.get(s.job_id) || {};
    const band = bandByScore.get(s.id) || null;
    const pipeline = latestForPipeline.get(s.candidate_id) === s.id;
    const label = labelFor({ expectedBand: band, stage: pipeline ? c.stage : null, rejectionReason: pipeline ? c.rejection_reason : null });
    return {
      scoreId: s.id,
      candidateId: s.candidate_id,
      jobId: s.job_id,
      agencyId: s.agency_id,
      matchScore: s.match_score,
      result: s.result || {},
      roleType: s.result?.role_type || job.parsed?.role_type || "professional",
      label,
      source: label === null ? null : band ? "recruiter band" : "pipeline outcome",
      expectedBand: band,
      createdAt: s.created_at,
      ...(withText ? { cvText: c.cv_text || "", jobText: job.job_text || "", jobParsed: job.parsed || null } : {}),
    };
  });
}
