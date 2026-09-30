// Keeping a job's parsed requirements (jobs.parsed - what screening scores
// against, see app/api/run) in step with edits made on the Jobs page
// (app/api/jobs/[id] PATCH, which writes the display columns).

// The job's parsed requirements with a recruiter's edits applied, or null
// when the job hasn't been parsed yet (its first screening reads the spec,
// and api/run keeps the result). Importance levels are kept for skills that
// are still required; a skill added by hand scores at the default level.
export function syncParsedRequirements(parsed, update) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.required_skills)) return null;
  const next = { ...parsed };
  if ("required_skills" in update) {
    next.required_skills = update.required_skills;
    const importance = parsed.skill_importance && typeof parsed.skill_importance === "object" ? parsed.skill_importance : {};
    next.skill_importance = Object.fromEntries(
      update.required_skills.filter((skill) => Object.hasOwn(importance, skill)).map((skill) => [skill, importance[skill]])
    );
  }
  if ("preferred_skills" in update) next.preferred_skills = update.preferred_skills;
  if ("min_years_experience" in update) next.min_years_experience = update.min_years_experience ?? 0;
  return next;
}
