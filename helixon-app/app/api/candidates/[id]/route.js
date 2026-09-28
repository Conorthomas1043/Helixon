import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { eraseCandidates } from "@/lib/candidate-erasure";
import { buildReport, matchHighlights } from "@/lib/analysis-report";
import { cleanEmail, cleanLine } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";

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

  const [{ data: notes }, { data: activity }, recruiterNames, { data: latestScore }] = await Promise.all([
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
    // The latest analysis: the full report on the profile, and whether it
    // was a blind screen (the documents panel asks before opening the
    // original CV, which shows who they are).
    supabase
      .from("scores")
      .select("id, job_id, created_at, result, jobs(title, client)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const extracted = candidate.extracted || {};

  // Candidates screened before match_summary/strengths/concerns were
  // written fall back to their latest analysis.
  const blind = latestScore?.result?.blind_mode === true;
  const fallback = latestScore?.result ? matchHighlights(latestScore.result) : null;
  const matchSummary = candidate.match_summary || fallback?.match_summary || null;
  const strengths = candidate.strengths?.length ? candidate.strengths : fallback?.strengths ?? [];
  const concerns = candidate.concerns?.length ? candidate.concerns : fallback?.concerns ?? [];

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
    matchSummary,
    strengths,
    concerns,
    skills: extracted.skills ?? [],
    education: toEducation(extracted),
    workHistory: toWorkHistory(extracted),
    // The original file (lib/candidate-files.js) - null for candidates
    // analysed before files were kept. Fetched via /api/candidates/[id]/cv.
    resume: candidate.cv_file_url
      ? { name: candidate.cv_filename || "CV", uploadedAt: candidate.created_at }
      : null,
    hasCvText: Boolean(candidate.cv_text && candidate.cv_text.trim()),
    screenedBlind: blind,
    // The full report from the latest analysis, same shape /api/run returns.
    analysis: latestScore?.result
      ? {
          scoreId: latestScore.id,
          jobId: latestScore.job_id,
          jobTitle: latestScore.jobs?.title || null,
          jobClient: latestScore.jobs?.client || null,
          analysedAt: latestScore.created_at,
          report: buildReport(latestScore.result, extracted, { blind }),
        }
      : null,
    tags: candidate.tags ?? [],
    nextAction: candidate.next_action,
    source: candidate.source,
    rejectionReason: candidate.rejection_reason,
    placementFee: candidate.placement_fee,
    placementCost: candidate.placement_cost,
    retention30d: candidate.retention_30d,
    retention90d: candidate.retention_90d,
    createdAt: candidate.created_at,
    lastActivityAt: candidate.last_activity_at,
    notes: (notes ?? []).map((n) => ({ id: n.id, author: n.author_name, createdAt: n.created_at, body: n.body })),
    activity: (activity ?? []).map((a) => ({ id: a.id, type: a.type, actor: a.actor, meta: a.meta, timestamp: a.created_at })),
  });
}

// Correcting what was read off the CV: name, contact details and current
// role. Extraction gets these wrong sometimes (a mangled name, a phone number
// from a referee), and there was no way to fix them. Only the fields sent are
// changed; "" or null clears one (except the name).
const EDITABLE = {
  fullName: { column: "full_name", label: "name", clean: (v) => cleanLine(v, 120) },
  email: { column: "email", label: "email", clean: (v) => cleanEmail(v), email: true },
  phone: { column: "phone", label: "phone", clean: (v) => cleanLine(v, 40) },
  linkedin: { column: "linkedin", label: "LinkedIn", clean: (v) => cleanLine(v, 200) },
  location: { column: "location", label: "location", clean: (v) => cleanLine(v, 120) },
  currentTitle: { column: "current_title", label: "current title", clean: (v) => cleanLine(v, 160) },
  currentCompany: { column: "current_company", label: "current company", clean: (v) => cleanLine(v, 160) },
};

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const update = {};
  const changed = [];
  for (const [key, field] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    const raw = body[key];
    const empty = raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (key === "fullName") {
        return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
      }
      update[field.column] = null;
    } else {
      const value = field.clean(raw);
      if (!value) {
        return NextResponse.json(
          { error: field.email ? "That doesn't look like a valid email address." : `Invalid ${field.label}.` },
          { status: 400 }
        );
      }
      update[field.column] = value;
    }
    changed.push(field.label);
  }
  // Older rows read `name`; keep it in step with full_name.
  if (update.full_name) update.name = update.full_name;

  if (changed.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("candidates")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select("id, full_name, name, email, phone, linkedin, location, current_title, current_company")
    .maybeSingle();

  if (error) {
    console.error("[candidates PATCH] Update failed:", error.message);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logActivity(supabase, id, "details_updated", recruiterDisplayName(profile) || userId, {
    note: `Updated ${changed.join(", ")}`,
  });

  return NextResponse.json({
    fullName: data.full_name || data.name || "Unnamed candidate",
    email: data.email,
    phone: data.phone,
    linkedin: data.linkedin,
    location: data.location,
    currentTitle: data.current_title,
    currentCompany: data.current_company,
  });
}

// Permanently erases a candidate and every row that references them - the
// tool an agency needs to fulfil a data subject's right to erasure (privacy
// policy: "Requests should be directed to the recruitment agency... who acts
// as the data controller"). The ordering and failure handling live in
// lib/candidate-erasure.js, shared with bulk delete.
export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data: candidate, error: lookupError } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Failed to look up candidate" }, { status: 500 });
  }
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { erased, failedStep } = await eraseCandidates(supabase, agencyId, [id]);
  if (failedStep || erased !== 1) {
    return NextResponse.json(
      { error: `Failed to erase candidate data (${failedStep || "candidates"}). Safe to retry.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
