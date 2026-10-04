// The profile as the page uses it: the API's shape plus job.company (the
// job's client). Used for both the server-loaded profile and the API one.
export function shapeCandidate(candidate) {
  return { ...candidate, job: candidate.job ? { ...candidate.job, company: candidate.job.client } : null };
}
