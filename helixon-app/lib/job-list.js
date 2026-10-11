import "server-only";

import { agencyDb } from "@/lib/agency-db";
import { getAccess, redactJob } from "@/lib/permissions";

// The agency's jobs, newest first, each with its screening counts. Shared by
// GET /api/jobs and the jobs page, which loads it on the server. Rows keep
// their database column names; lib/api-client/jobs.js's adaptJob turns them
// into the shape the pages use. Contract: lib/contracts/jobs.js.

/** @typedef {import("@/lib/contracts/jobs").JobWithCounts} JobWithCounts */

// Each job is read with its candidates' stage and score, for the counts.
export const JOB_WITH_CANDIDATES = "*, candidates(id, processing_status, stage, match_score)";

/**
 * A job row (read with JOB_WITH_CANDIDATES) as the API returns it: money
 * hidden from members who can't see it, and the candidates replaced by
 * counts. Also the body of GET /api/jobs/[id].
 *
 * @param {any} job
 * @param {any} access getAccess()'s answer for the member asking
 * @returns {JobWithCounts}
 */
export function withCounts(job, access) {
  const candidates = job.candidates ?? [];
  const completed = candidates.filter((c) => c.processing_status === "completed");
  const { candidates: _candidates, ...row } = redactJob(job, access);
  return {
    ...row,
    candidateCount: candidates.length,
    strongMatches: completed.filter((c) => c.match_score !== null && c.match_score >= 80).length,
    shortlisted: completed.filter((c) => c.stage === "Shortlisted").length,
    interviewing: completed.filter((c) => c.stage === "Interview").length,
    offers: completed.filter((c) => c.stage === "Offer").length,
    placed: completed.filter((c) => c.stage === "Placed").length,
  };
}

/**
 * @param {{ agencyId: string }} auth a signed-in member
 * @returns {Promise<JobWithCounts[]>}
 */
export async function listJobs(auth) {
  const { agencyId } = auth;
  const access = await getAccess(auth);
  const { data: jobs, error } = await (await agencyDb())
    .from("jobs")
    .select(JOB_WITH_CANDIDATES)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`jobs query failed: ${error.message}`);

  return jobs.map((job) => withCounts(job, access));
}
