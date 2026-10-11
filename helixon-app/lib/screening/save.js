// Saving a finished screening (POST /api/run): the candidate, the job (unless
// a saved one was used), the score, the stored CV and the timeline entry.
// Every row belongs to the signed-in member's agency, never one the browser
// names. If a write fails part-way, what was created is removed again, so a
// half-saved screening never shows up in the pipeline.

import { estimateSalary } from "@/lib/cv-analysis";
import { recruiterDisplayName } from "@/lib/agency/recruiter-directory";
import { findExistingPerson } from "@/lib/candidates/duplicates";
import { ensureClient } from "@/lib/clients/core";
import { storeCandidateCv, removeCandidateCvs } from "@/lib/candidates/files";
import { matchHighlights } from "@/lib/screening/analysis-report";
import { reportError } from "@/lib/report-error";

// jobs.role_tier allows only entry_level, skilled and senior, while job
// extraction also says entry and executive. The full value stays in
// jobs.parsed for scoring.
const DB_ROLE_TIERS = { entry: "entry_level", entry_level: "entry_level", skilled: "skilled", senior: "senior", executive: "senior" };

export function dbRoleTier(tier) {
  return DB_ROLE_TIERS[String(tier || "").toLowerCase()] || "skilled";
}

function salaryFor(extracted, result, jobParsed) {
  try {
    return estimateSalary(extracted, { relevantYears: result?.relevant_years_experience ?? null, job: jobParsed || {} });
  } catch (error) {
    console.warn("[run] Salary estimate failed:", error?.message);
    return null;
  }
}

async function newJobRow({ agencyId, userId, jobText, jobParsed, clientEmail, saveJob }) {
  // The client named in the description becomes (or is matched to) one of
  // the agency's clients - lib/clients/core.js.
  const client = await ensureClient(agencyId, jobParsed?.client)
    .then((c) => (c ? { client: c.name, client_id: c.id } : { client: jobParsed?.client || null }))
    .catch(() => ({ client: jobParsed?.client || null }));
  return {
    agency_id: agencyId,
    user_id: userId,
    title: jobParsed?.title || "Untitled Role",
    ...client,
    client_email: clientEmail || jobParsed?.client_email || null,
    job_text: jobText,
    parsed: jobParsed || {},
    role_tier: dbRoleTier(jobParsed?.role_tier),
    is_saved: saveJob,
    status: "open",
    location: jobParsed?.location || null,
    employment_type: jobParsed?.employment_type || null,
    seniority: jobParsed?.seniority || null,
    salary_range: jobParsed?.salary_range || null,
    required_skills: jobParsed?.required_skills || [],
    preferred_skills: jobParsed?.preferred_skills || [],
    min_years_experience: jobParsed?.min_years_experience || null,
  };
}

/**
 * @param {{
 *   db: any, supabase: any, agencyId: string, userId: string, profile: any,
 *   input: { file: File, jobText: string, requirements: string[], blind: boolean, clientEmail: string, saveJob: boolean },
 *   existingJob: any | null, reusedJobParsed: any | null,
 *   analysis: { cvText: string, extracted: any, result: any, jobParsed: any },
 * }} args
 */
export async function saveScreening({ db, supabase, agencyId, userId, profile, input, existingJob, reusedJobParsed, analysis }) {
  const { cvText, result, jobParsed } = analysis;
  const ex = analysis.extracted || {};
  const actor = recruiterDisplayName(profile) || userId;
  const matchScore = result?.match_score ?? 0;
  const recommendation = result?.recommendation || "Review";

  // A job created by hand has no parsed requirements until its first
  // screening; keep them so later CVs against it reuse them.
  const sameText = existingJob?.job_text && existingJob.job_text.trim() === input.jobText.trim();
  if (existingJob && !reusedJobParsed && sameText && input.requirements.length === 0 && jobParsed && !existingJob.parsed?.required_skills) {
    const { error } = await db.from("jobs").update({ parsed: jobParsed }).eq("id", existingJob.id).eq("agency_id", agencyId);
    if (error) console.warn("[run] Couldn't save parsed requirements on the job:", error.message);
  }

  const salary = salaryFor(ex, result, jobParsed);

  // Someone already on file (same email or LinkedIn) is linked to their
  // existing record - lib/candidates/duplicates.js.
  const existingPerson = await findExistingPerson(supabase, agencyId, ex);

  const { data: candidate, error: candidateError } = await db
    .from("candidates")
    .insert({
      agency_id: agencyId,
      user_id: userId,
      recruiter_id: userId,
      name: ex.name || "Candidate",
      full_name: ex.name || "Candidate",
      email: ex.email || null,
      phone: ex.phone || null,
      linkedin: ex.linkedin || null,
      current_title: ex.current_title || null,
      current_company: ex.current_employer || null,
      location: ex.location || null,
      cv_text: cvText || "",
      extracted: ex,
      processing_status: "completed",
      pooled_from_id: existingPerson?.rootId ?? null,
    })
    .select()
    .single();
  if (candidateError) throw new Error(candidateError.message);

  let createdJobId = null;
  const cleanup = async () => {
    await db.from("candidates").delete().eq("id", candidate.id);
    if (createdJobId) await db.from("jobs").delete().eq("id", createdJobId);
  };

  let job = existingJob;
  if (!job) {
    const { data: newJob, error: jobError } = await db
      .from("jobs")
      .insert(await newJobRow({ agencyId, userId, jobText: input.jobText, jobParsed, clientEmail: input.clientEmail, saveJob: input.saveJob }))
      .select()
      .single();
    if (jobError) {
      await cleanup();
      throw new Error(jobError.message);
    }
    job = newJob;
    createdJobId = newJob.id;
  }

  const { data: score, error: scoreError } = await db
    .from("scores")
    .insert({
      agency_id: agencyId,
      candidate_id: candidate.id,
      job_id: job.id,
      user_id: userId,
      match_score: matchScore,
      recommendation,
      result: {
        ...(result || {}),
        salary_estimate: salary,
        // Read by the candidate page to warn before opening the original CV
        // of someone screened blind.
        blind_mode: input.blind,
        lawful_basis: { confirmed: true, by: actor, at: new Date().toISOString() },
      },
      source: "single",
      // scores.stage has its own check constraint with a legacy lowercase
      // vocabulary (new, shortlisted, ...), not the Title Case funnel
      // candidates.stage uses. A score is the append-only record of one
      // analysis, so it's always "new"; the live stage is on the candidate.
      stage: "new",
    })
    .select()
    .single();
  if (scoreError) {
    await cleanup();
    throw new Error(scoreError.message);
  }

  // The original CV, for preview, download and sending. Stored after every
  // other write, so cleanup() never has a file to leave behind; a storage
  // failure costs the file, not the screening.
  let storedCv = null;
  try {
    storedCv = await storeCandidateCv({ agencyId, candidateId: candidate.id, file: input.file });
  } catch (err) {
    reportError("[run] Failed to store CV file:", err?.message);
  }

  // The live pipeline values the rest of the app reads: stage, score and job
  // on the candidate itself, plus the "why they match" highlights.
  const { error: candidateUpdateError } = await db
    .from("candidates")
    .update({
      stage: "Screened",
      match_score: matchScore,
      recommendation,
      job_id: job.id,
      ...matchHighlights(result),
      ...(storedCv ? { cv_file_url: storedCv.path, cv_filename: storedCv.fileName } : {}),
    })
    .eq("id", candidate.id);
  if (candidateUpdateError) {
    reportError("[run] Failed to update candidate with analysis result:", candidateUpdateError.message);
    // Unlinked, nothing could reach or delete the file: remove it.
    if (storedCv) await removeCandidateCvs([storedCv.path]);
  }

  await supabase.from("candidate_activity").insert({
    candidate_id: candidate.id,
    type: "screened",
    actor,
    meta: {
      job_id: job.id,
      score_id: score.id,
      match_score: matchScore,
      lawful_basis_confirmed: true,
      ...(existingPerson ? { linked_to: existingPerson.rootId, matched_on: existingPerson.matchedOn } : {}),
    },
  });

  return { candidate, job, score, salary, existingPerson, extracted: ex };
}

/**
 * When the screened person was already on file: who they are, and whether
 * this is a second record for the very same job.
 */
export async function duplicateNotice(db, { agencyId, candidateId, jobId, existingPerson }) {
  if (!existingPerson) return null;
  const { data: sameJobRow } = await db
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("job_id", jobId)
    .neq("id", candidateId)
    .or(`id.eq.${existingPerson.rootId},pooled_from_id.eq.${existingPerson.rootId}`)
    .limit(1)
    .maybeSingle();
  return { candidateId: existingPerson.rootId, matchedOn: existingPerson.matchedOn, sameJobCandidateId: sameJobRow?.id ?? null };
}
