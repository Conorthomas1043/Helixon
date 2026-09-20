import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";

// See app/api/candidates/route.js for why this was rewritten (dead auth
// helper, no agency scoping). `.eq("agency_id", agencyId)` here is what
// stops one agency from reading another's candidate by guessing/enumerating
// ids.
//
// education/workHistory are reshaped from `extracted` (the CV-extraction
// pipeline's output - see lib/cv-analysis) into the {degree,school,years}/
// {title,company,start,end,description} shape the candidate profile page
// was built against, since the extractor's own shape (education as plain
// strings, positions as {title,company,duration}) is thinner than that.
function toEducation(extracted) {
  return (extracted?.education || []).map((e) =>
    typeof e === "string" ? { degree: e, school: null, years: null } : e
  );
}

function toWorkHistory(extracted) {
  return (extracted?.positions || []).map((p) => ({
    title: p.title || "Role",
    company: p.company || null,
    start: p.duration || null,
    end: null,
    description: null,
  }));
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, jobs(*)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: notes }, { data: activity }, recruiterNames] = await Promise.all([
    supabase
      .from("candidate_notes")
      .select("id, author_name, body, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_activity")
      .select("id, type, actor, meta, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    resolveRecruiterNames(supabase, [candidate.recruiter_id]),
  ]);

  const extracted = candidate.extracted || {};

  return NextResponse.json({
    id: candidate.id,
    fullName: candidate.full_name || candidate.name || "Unnamed candidate",
    email: candidate.email,
    phone: candidate.phone,
    linkedin: candidate.linkedin,
    location: candidate.location,
    currentTitle: candidate.current_title,
    currentCompany: candidate.current_company,
    yearsExperience: candidate.years_experience ?? extracted.years_experience ?? null,
    jobId: candidate.job_id,
    job: candidate.jobs ?? null,
    jobTitle: candidate.jobs?.title || "Unspecified role",
    company: candidate.jobs?.client ?? null,
    recruiterId: candidate.recruiter_id,
    recruiterName: recruiterNames.get(candidate.recruiter_id) ?? null,
    status: candidate.processing_status,
    stage: candidate.stage,
    score: candidate.match_score,
    matchSummary: candidate.match_summary,
    strengths: candidate.strengths ?? [],
    concerns: candidate.concerns ?? [],
    skills: extracted.skills ?? [],
    education: toEducation(extracted),
    workHistory: toWorkHistory(extracted),
    resume: candidate.cv_filename
      ? { name: candidate.cv_filename, sizeKb: null, uploadedAt: candidate.created_at }
      : null,
    tags: candidate.tags ?? [],
    nextAction: candidate.next_action,
    createdAt: candidate.created_at,
    lastActivityAt: candidate.last_activity_at,
    notes: (notes ?? []).map((n) => ({ id: n.id, author: n.author_name, createdAt: n.created_at, body: n.body })),
    activity: (activity ?? []).map((a) => ({ id: a.id, type: a.type, actor: a.actor, meta: a.meta, timestamp: a.created_at })),
  });
}
