import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*, candidates(id, status, stage, match_score)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "Failed to load jobs" }, { status: 500 });

  return Response.json(
    jobs.map((job) => {
      const completed = job.candidates.filter((c) => c.status === "completed");
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
    })
  );
}

export async function POST(request) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const body = await request.json();
  if (!body.title?.trim()) return Response.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      agency_id: recruiter.agency_id,
      title: body.title.trim(),
      company: body.company ?? null,
      location: body.location ?? null,
      employment_type: body.employmentType ?? null,
      seniority: body.seniority ?? null,
      salary_range: body.salaryRange ?? null,
      required_skills: body.requiredSkills ?? [],
      preferred_skills: body.preferredSkills ?? [],
      min_years_experience: body.minYearsExperience ?? null,
      job_text: body.jobText ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: "Failed to create job" }, { status: 500 });
  return Response.json(data, { status: 201 });
}
