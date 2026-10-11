// The profile as the page uses it: the API's shape plus job.company (the
// job's client). Used for both the server-loaded profile and the API one.

/** @typedef {import("@/lib/contracts/candidates").CandidateProfile} CandidateProfile */
/** @typedef {import("@/lib/contracts/candidates").ShapedCandidateProfile} ShapedCandidateProfile */

/**
 * @param {CandidateProfile} candidate
 * @returns {ShapedCandidateProfile}
 */
export function shapeCandidate(candidate) {
  return { ...candidate, job: candidate.job ? { ...candidate.job, company: candidate.job.client ?? null } : null };
}
