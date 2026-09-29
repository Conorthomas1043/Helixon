// Screening someone already on file against another job - from the talent
// pool, or "Screen for another role" on a profile - without re-uploading
// their CV. The stored CV text and extraction are reused; the result is a
// new candidate row for that job (the pipeline tracks one row per person
// per job), linked back through pooled_from_id so the app can tell
// "already screened for this job" and list a person's other roles.

import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import { matchHighlights } from "@/lib/analysis-report";
import { copyCandidateCv } from "@/lib/candidate-files";

const SOURCE_COLUMNS =
  "id, agency_id, name, full_name, email, phone, linkedin, current_title, current_company, location, years_experience, cv_text, extracted, cv_file_url, cv_filename, pooled_from_id";

// The row every re-screen of this person hangs off.
export function poolRootId(candidate) {
  return candidate.pooled_from_id || candidate.id;
}

// A job's description as text: what it was created from, or its fields for
// one added by hand without a pasted description.
export function jobTextFor(job) {
  if (job.job_text && job.job_text.trim().length >= 50) return job.job_text;
  const lines = [
    job.title && `Job title: ${job.title}`,
    job.client && `Client: ${job.client}`,
    job.location && `Location: ${job.location}`,
    job.seniority && `Seniority: ${job.seniority}`,
    job.employment_type && `Employment type: ${job.employment_type}`,
    job.min_years_experience && `Minimum experience: ${job.min_years_experience} years`,
    job.required_skills?.length && `Required skills: ${job.required_skills.join(", ")}`,
    job.preferred_skills?.length && `Preferred skills: ${job.preferred_skills.join(", ")}`,
    job.job_text,
  ].filter(Boolean);
  return lines.join("\n");
}

// Rows for the same person (the root and everything re-screened from it)
// that are already on this job.
export async function existingScreening(supabase, agencyId, rootId, jobId) {
  const { data, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("job_id", jobId)
    .or(`id.eq.${rootId},pooled_from_id.eq.${rootId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

// Returns { candidateId, score, recommendation } or { error, status, existingId? }.
export async function rescreenCandidate(supabase, { agencyId, userId, actor, sourceId, jobId }) {
  const [{ data: source }, { data: job }] = await Promise.all([
    supabase.from("candidates").select(SOURCE_COLUMNS).eq("id", sourceId).eq("agency_id", agencyId).maybeSingle(),
    supabase.from("jobs").select("*").eq("id", jobId).eq("agency_id", agencyId).maybeSingle(),
  ]);
  if (!source) return { error: "Candidate not found.", status: 404 };
  if (!job) return { error: "That job could not be found.", status: 404 };
  if (!source.cv_text || !source.cv_text.trim()) {
    return { error: "There's no CV text on file for this candidate - upload their CV on Analyse instead.", status: 422 };
  }

  const rootId = poolRootId(source);
  const existingId = await existingScreening(supabase, agencyId, rootId, jobId);
  if (existingId) {
    return { error: "Already screened for this job.", status: 409, existingId };
  }

  const jobText = jobTextFor(job);
  if (jobText.trim().length < 50) {
    return { error: "This job needs a description or skills before candidates can be screened against it.", status: 422 };
  }
  const knownJobParsed = job.parsed && Array.isArray(job.parsed.required_skills) ? job.parsed : null;

  const { extracted, result, jobParsed } = await analyseCV(null, jobText, {
    cvText: source.cv_text,
    extracted: source.extracted,
    jobParsed: knownJobParsed,
  });

  // Keep what the first read of this job found, like /api/run does.
  if (!knownJobParsed && jobParsed && !job.parsed?.required_skills) {
    await supabase.from("jobs").update({ parsed: jobParsed }).eq("id", job.id).eq("agency_id", agencyId);
  }

  let salary = null;
  try {
    salary = estimateSalary(extracted || {}, { relevantYears: result?.relevant_years_experience ?? null, job: jobParsed || {} });
  } catch {
    // Optional - the analysis stands without it.
  }

  const { data: candidate, error: insertError } = await supabase
    .from("candidates")
    .insert({
      agency_id: agencyId,
      user_id: userId,
      recruiter_id: userId,
      name: source.full_name || source.name || "Candidate",
      full_name: source.full_name || source.name || "Candidate",
      email: source.email,
      phone: source.phone,
      linkedin: source.linkedin,
      current_title: source.current_title,
      current_company: source.current_company,
      location: source.location,
      years_experience: source.years_experience,
      cv_text: source.cv_text,
      extracted: extracted || source.extracted,
      processing_status: "completed",
      source: "agency_database",
      pooled_from_id: rootId,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const { data: score, error: scoreError } = await supabase
    .from("scores")
    .insert({
      agency_id: agencyId,
      candidate_id: candidate.id,
      job_id: job.id,
      user_id: userId,
      match_score: result?.match_score ?? 0,
      recommendation: result?.recommendation || "Review",
      // Screened from the CV already on file; the lawful basis confirmed
      // when it was first screened is carried over.
      result: { ...(result || {}), salary_estimate: salary, blind_mode: false, lawful_basis: { confirmed: true, by: actor, at: new Date().toISOString(), from_candidate_id: source.id } },
      source: "talent_pool",
      // scores.stage uses its own legacy vocabulary - see app/api/run.
      stage: "new",
    })
    .select("id")
    .single();
  if (scoreError) {
    await supabase.from("candidates").delete().eq("id", candidate.id);
    throw new Error(scoreError.message);
  }

  let cvFile = null;
  if (source.cv_file_url && !/^https?:/i.test(source.cv_file_url)) {
    try {
      cvFile = await copyCandidateCv({ agencyId, candidateId: candidate.id, fromPath: source.cv_file_url });
    } catch (err) {
      console.error("[rescreen] Couldn't copy the CV file:", err.message);
    }
  }

  const { error: updateError } = await supabase
    .from("candidates")
    .update({
      stage: "Screened",
      match_score: result?.match_score ?? 0,
      recommendation: result?.recommendation || "Review",
      job_id: job.id,
      last_activity_at: new Date().toISOString(),
      ...matchHighlights(result),
      ...(cvFile ? { cv_file_url: cvFile.path, cv_filename: source.cv_filename } : {}),
    })
    .eq("id", candidate.id);
  if (updateError) console.error("[rescreen] Failed to update candidate with result:", updateError.message);

  await supabase.from("candidate_activity").insert([
    {
      candidate_id: candidate.id,
      type: "screened",
      actor,
      meta: { job_id: job.id, score_id: score.id, match_score: result?.match_score ?? 0, from_candidate_id: source.id },
    },
    {
      candidate_id: source.id,
      type: "rescreened",
      actor,
      meta: { job_id: job.id, job_title: job.title, candidate_id: candidate.id, match_score: result?.match_score ?? 0 },
    },
  ]);

  return {
    candidateId: candidate.id,
    score: result?.match_score ?? 0,
    recommendation: result?.recommendation || "Review",
    job: { id: job.id, title: job.title },
  };
}
