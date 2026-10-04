import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { JobInput } from "@/lib/api/schemas";
import { cleanText, cleanLine, cleanList, cleanNumber, cleanEmail } from "@/lib/sanitize";
import { jobClientColumns, logClientActivity } from "@/lib/clients";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { agencyDb } from "@/lib/agency-db";
import { listJobs } from "@/lib/job-list";
import { reportError } from "@/lib/report-error";

// GET /api/jobs - the agency's jobs with screening counts (lib/job-list.js).
export const GET = customerRoute(async (_request, _context, auth) => {
  try {
    return NextResponse.json(await listJobs(auth));
  } catch (err) {
    reportError("[jobs] List failed:", err);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
});

export const POST = customerRoute(async (request, _context, auth, input) => {
  const { agencyId, userId } = auth;

  const body = input;
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

  const { data, error } = await (await agencyDb())
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
}, { body: JobInput, optionalBody: true });
