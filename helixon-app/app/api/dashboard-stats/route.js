import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { computeCandidateStats } from "@/lib/dashboard-model";

export async function GET() {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  // agency_id is never taken from the client - RLS scopes every query
  // below to recruiter.agency_id automatically via current_agency_id().

  const [{ data: agency }, { data: candidateRows, error: candErr }, { data: jobRows }, { data: recruiterRows }] =
    await Promise.all([
      supabase.from("agencies").select("name, plan_name, analyses_used, analyses_limit").single(),
      supabase
        .from("candidates")
        .select(
          "id, full_name, status, stage, match_score, created_at, job:jobs(id, title, company), recruiter:recruiters(id, name)"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("jobs").select("id, title, company"),
      supabase.from("recruiters").select("id, name"),
    ]);

  if (candErr) {
    return Response.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const analyses = (candidateRows ?? []).map((c) => ({
    id: c.id,
    candidateName: c.full_name ?? "Unnamed candidate",
    jobTitle: c.job?.title ?? "Unspecified role",
    company: c.job?.company ?? null,
    recruiterName: c.recruiter?.name ?? null,
    status: c.status,
    stage: c.stage,
    score: c.match_score,
    createdAt: c.created_at ? new Date(c.created_at) : null,
  }));

  const stats = computeCandidateStats(analyses);

  // Active jobs - real entities now, not derived-from-analyses groupings.
  const jobCandidateCounts = new Map();
  analyses
    .filter((a) => a.status === "completed")
    .forEach((a) => {
      const jobId = candidateRows.find((c) => c.id === a.id)?.job?.id;
      if (!jobId) return;
      const entry = jobCandidateCounts.get(jobId) ?? { candidateCount: 0, strongMatches: 0 };
      entry.candidateCount += 1;
      if (a.score !== null && a.score >= 80) entry.strongMatches += 1;
      jobCandidateCounts.set(jobId, entry);
    });

  const jobs = (jobRows ?? [])
    .map((j) => ({
      id: j.id,
      jobTitle: j.title,
      company: j.company,
      ...(jobCandidateCounts.get(j.id) ?? { candidateCount: 0, strongMatches: 0 }),
    }))
    .filter((j) => j.candidateCount > 0)
    .sort((a, b) => b.candidateCount - a.candidateCount)
    .slice(0, 5);

  // Recruiter performance - now a real per-seat query instead of grouping
  // by a free-text name string.
  const recruiterStats = new Map();
  analyses
    .filter((a) => a.status === "completed")
    .forEach((a) => {
      const recId = candidateRows.find((c) => c.id === a.id)?.recruiter?.id;
      if (!recId) return;
      const entry = recruiterStats.get(recId) ?? { completed: 0, scoreSum: 0, scoreCount: 0, placements: 0 };
      entry.completed += 1;
      if (a.score !== null) {
        entry.scoreSum += a.score;
        entry.scoreCount += 1;
      }
      if (a.stage === "Placed") entry.placements += 1;
      recruiterStats.set(recId, entry);
    });

  const recruiters = (recruiterRows ?? [])
    .map((r) => {
      const s = recruiterStats.get(r.id) ?? { completed: 0, scoreSum: 0, scoreCount: 0, placements: 0 };
      return {
        name: r.name,
        completed: s.completed,
        placements: s.placements,
        avgScore: s.scoreCount > 0 ? Math.round(s.scoreSum / s.scoreCount) : null,
      };
    })
    .filter((r) => r.completed > 0)
    .sort((a, b) => b.placements - a.placements || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 4);

  return Response.json({
    agencyName: agency?.name ?? "your agency",
    plan: agency
      ? { name: agency.plan_name, analysesUsed: agency.analyses_used, analysesLimit: agency.analyses_limit }
      : null,
    ...stats,
    jobs,
    recruiters,
  });
}
