import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanText, cleanLine, cleanList, cleanNumber } from "@/lib/sanitize";

// See app/api/candidates/route.js for why this was rewritten - Clerk auth
// instead of the dead Supabase-Auth bearer-token check, and agency_id
// scoping that was previously missing entirely.
export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*, candidates(id, processing_status, stage, match_score)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }

  return NextResponse.json(
    jobs.map((job) => {
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
    })
  );
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId } = auth;

  const body = (await request.json().catch(() => null)) ?? {};
  const title = cleanLine(body.title, 160);
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      agency_id: agencyId,
      user_id: userId,
      title,
      client: cleanLine(body.company, 160) || null,
      location: cleanLine(body.location, 160) || null,
      employment_type: cleanLine(body.employmentType, 60) || null,
      seniority: cleanLine(body.seniority, 60) || null,
      salary_range: cleanLine(body.salaryRange, 80) || null,
      required_skills: cleanList(body.requiredSkills),
      preferred_skills: cleanList(body.preferredSkills),
      min_years_experience: cleanNumber(body.minYearsExperience, { min: 0, max: 60 }),
      job_text: cleanText(body.jobText, { max: 20000 }) || null,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
