import "server-only";

import { agencyDb } from "@/lib/agency-db";

// The agency's jobs, newest first, each with its screening counts. Shared by
// GET /api/jobs and the jobs page, which loads it on the server. Rows keep
// their database column names; lib/api-client/jobs.js's adaptJob turns them
// into the shape the pages use.

/**
 * @param {{ agencyId: string }} auth a signed-in member
 * @returns {Promise<object[]>}
 */
export async function listJobs({ agencyId }) {
  const { data: jobs, error } = await (await agencyDb())
    .from("jobs")
    .select("*, candidates(id, processing_status, stage, match_score)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`jobs query failed: ${error.message}`);

  return jobs.map((job) => {
    const completed = job.candidates.filter((c) => c.processing_status === "completed");
    return {
      ...job,
      candidates: undefined,
      candidateCount: job.candidates.length,
      strongMatches: completed.filter((c) => c.match_score !== null && c.match_score >= 80).length,
      shortlisted: completed.filter((c) => c.stage === "Shortlisted").length,
      interviewing: completed.filter((c) => c.stage === "Interview").length,
      offers: completed.filter((c) => c.stage === "Offer").length,
      placed: completed.filter((c) => c.stage === "Placed").length,
    };
  });
}
