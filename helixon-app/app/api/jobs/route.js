import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanText, cleanLine, cleanList, cleanNumber, cleanEmail } from "@/lib/sanitize";
import { jobClientColumns, logClientActivity } from "@/lib/clients";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

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
    return NextResponse.json({ error: "A job title is required." }, { status: 400 });
  }
  // CVs are screened against this text (app/api/run needs at least 50
  // characters), so a job without a real description can't be used.
  const jobText = cleanText(body.jobText, { max: 20000 });
  if (jobText.length < 50) {
    return NextResponse.json(
      { error: "Add the job description (at least 50 characters) - CVs are screened against it." },
      { status: 400 }
    );
  }

  // The client: picked from the agency's clients (clientId, contactId) or
  // typed (company) - a typed name is matched to, or becomes, a client.
  const clientCols = await jobClientColumns(agencyId, {
    clientId: body.clientId || undefined,
    clientName: body.clientId ? undefined : cleanLine(body.company, 160) || undefined,
    contactId: body.contactId || undefined,
  });
  if (clientCols.error) return NextResponse.json({ error: clientCols.error }, { status: 400 });

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      agency_id: agencyId,
      user_id: userId,
      title,
      client: null,
      client_email: cleanEmail(body.clientEmail) || null,
      ...clientCols.update,
      location: cleanLine(body.location, 160) || null,
      employment_type: cleanLine(body.employmentType, 60) || null,
      seniority: cleanLine(body.seniority, 60) || null,
      salary_range: cleanLine(body.salaryRange, 80) || null,
      required_skills: cleanList(body.requiredSkills),
      preferred_skills: cleanList(body.preferredSkills),
      min_years_experience: cleanNumber(body.minYearsExperience, { min: 0, max: 60 }),
      job_text: jobText,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
  if (data.client_id) {
    await logClientActivity(agencyId, data.client_id, "job_created", recruiterDisplayName(auth.profile) || userId, { note: data.title, job_id: data.id });
  }
  return NextResponse.json(data, { status: 201 });
}
