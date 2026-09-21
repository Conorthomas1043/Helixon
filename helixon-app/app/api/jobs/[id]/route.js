import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*, candidates(id, processing_status, stage, match_score)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const completed = job.candidates.filter((c) => c.processing_status === "completed");
  return NextResponse.json({
    ...job,
    candidates: undefined,
    candidateCount: job.candidates.length,
    strongMatches: completed.filter((c) => c.match_score !== null && c.match_score >= 80).length,
    shortlisted: completed.filter((c) => c.stage === "Shortlisted").length,
    interviewing: completed.filter((c) => c.stage === "Interview").length,
    offers: completed.filter((c) => c.stage === "Offer").length,
    placed: completed.filter((c) => c.stage === "Placed").length,
  });
}

const VALID_STATUSES = new Set(["open", "closed"]);

// Max lengths mirror the columns this actually writes to - generous enough
// for a real job spec, tight enough to stop an accidental multi-MB paste.
const MAX_TITLE_LEN = 200;
const MAX_CLIENT_LEN = 200;
const MAX_LOCATION_LEN = 200;
const MAX_SKILL_LEN = 100;
const MAX_SKILLS = 40;

function cleanString(value, maxLen) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return { error: true };
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return { error: true };
  return trimmed || null;
}

function cleanSkillList(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return { error: true };
  if (value.length > MAX_SKILLS) return { error: true };
  const cleaned = [];
  for (const item of value) {
    if (typeof item !== "string") return { error: true };
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > MAX_SKILL_LEN) return { error: true };
    cleaned.push(trimmed);
  }
  return cleaned;
}

// Replaces app/api/jobs/[id]/update-status (retired - no auth, no agency
// check, and broken on every call from reading `params` without awaiting
// it). Also now handles editing a job's title/requirements, which nothing
// previously did - a typo in a job title was permanent. Deliberately
// still doesn't let the raw job spec text (job_text) be edited: that's
// what every future analysis against this job re-parses skills/seniority
// from (see api/run's existingJobId handling, which always takes fresh
// jobText from the analysis request, never reads job_text back out) -
// editing the structured fields here can't drift out of sync with
// anything else the way editing the free-text spec without re-parsing it
// could.
export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "status must be 'open' or 'closed'." }, { status: 400 });
    }
    update.status = body.status;
  }

  const title = cleanString(body.title, MAX_TITLE_LEN);
  if (title?.error) return NextResponse.json({ error: `Title must be ${MAX_TITLE_LEN} characters or fewer.` }, { status: 400 });
  if (title !== undefined) {
    if (!title) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    update.title = title;
  }

  const client = cleanString(body.client, MAX_CLIENT_LEN);
  if (client?.error) return NextResponse.json({ error: `Client must be ${MAX_CLIENT_LEN} characters or fewer.` }, { status: 400 });
  if (client !== undefined) update.client = client;

  const location = cleanString(body.location, MAX_LOCATION_LEN);
  if (location?.error) return NextResponse.json({ error: `Location must be ${MAX_LOCATION_LEN} characters or fewer.` }, { status: 400 });
  if (location !== undefined) update.location = location;

  const employmentType = cleanString(body.employmentType, 50);
  if (employmentType?.error) return NextResponse.json({ error: "Employment type is too long." }, { status: 400 });
  if (employmentType !== undefined) update.employment_type = employmentType;

  const seniority = cleanString(body.seniority, 50);
  if (seniority?.error) return NextResponse.json({ error: "Seniority is too long." }, { status: 400 });
  if (seniority !== undefined) update.seniority = seniority;

  if (body.minYearsExperience !== undefined) {
    const raw = body.minYearsExperience;
    if (raw === null) {
      update.min_years_experience = null;
    } else if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 60) {
      return NextResponse.json({ error: "Minimum years of experience must be a number between 0 and 60." }, { status: 400 });
    } else {
      update.min_years_experience = Math.round(raw);
    }
  }

  const requiredSkills = cleanSkillList(body.requiredSkills);
  if (requiredSkills?.error) return NextResponse.json({ error: `Required skills: up to ${MAX_SKILLS}, each under ${MAX_SKILL_LEN} characters.` }, { status: 400 });
  if (requiredSkills !== undefined) update.required_skills = requiredSkills;

  const preferredSkills = cleanSkillList(body.preferredSkills);
  if (preferredSkills?.error) return NextResponse.json({ error: `Preferred skills: up to ${MAX_SKILLS}, each under ${MAX_SKILL_LEN} characters.` }, { status: 400 });
  if (preferredSkills !== undefined) update.preferred_skills = preferredSkills;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select("id, status, title, client, location, employment_type, seniority, min_years_experience, required_skills, preferred_skills")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to update job." }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}

// Deliberately refuses to delete a job with any candidates attached, rather
// than either blocking on a foreign-key error (this repo's migrations
// don't fully specify jobs' FK behaviour where candidates.job_id points at
// it) or silently cascading and wiping out real screened candidates,
// scores and notes a recruiter cares about. "Closed" (via PATCH status)
// already covers "no longer active but keep the history" - DELETE is only
// for a job with nothing attached to it yet, e.g. one created by mistake.
export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, candidates(id)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.candidates.length > 0) {
    return NextResponse.json(
      { error: "This job has candidates attached, so it can't be deleted. Mark it as closed instead." },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase.from("jobs").delete().eq("id", id).eq("agency_id", agencyId);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete job." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
