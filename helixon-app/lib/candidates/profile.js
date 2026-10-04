// One candidate's profile, as the profile page shows it: the candidate, their
// notes and activity, the latest analysis, the talent-pool entry and the other
// roles they've been screened for. Shared by GET /api/candidates/[id] and the
// profile page, which loads it on the server so the page arrives with it.
//
// `auth` is a requireCustomerContext() result; everything is scoped to its
// agency and to what this member may see (lib/permissions.js).

import "server-only";
import { supabase } from "@/lib/supabase";
import { agencyDb } from "@/lib/agency-db";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { buildReport, matchHighlights } from "@/lib/analysis-report";
import { candidateHidden, getAccess } from "@/lib/permissions";

const NOT_FOUND = { status: 404, error: "Not found" };

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

// Notes, newest first, with when they were pinned.
async function loadNotes(candidateId) {
  const db = await agencyDb();
  return db
    .from("candidate_notes")
    .select("id, author_id, author_name, note, created_at, pinned_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
}

// { status: 200, body } or { status: 404, error }.
export async function loadCandidateProfile(auth, id) {
  if (await candidateHidden(auth, id)) return NOT_FOUND;
  const { agencyId } = auth;


  const { data: candidate, error } = await (await agencyDb())
    .from("candidates")
    .select("*, jobs(*)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !candidate) {
    return NOT_FOUND;
  }

  const [{ data: notes }, { data: activity }, recruiterNames, { data: latestScore }] = await Promise.all([
    loadNotes(id),
    supabase
      .from("candidate_activity")
      .select("id, type, actor, meta, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    resolveRecruiterNames(supabase, [candidate.recruiter_id]),
    // The latest analysis: the full report on the profile, and whether it
    // was a blind screen (the documents panel asks before opening the
    // original CV, which shows who they are).
    (await agencyDb())
      .from("scores")
      .select("id, job_id, created_at, result, jobs(title, client)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const extracted = candidate.extracted || {};

  // The talent pool entry and every role this person has been screened for
  // live on their first row (lib/rescreen.js) - this one, or the one it was
  // screened from.
  const rootId = candidate.pooled_from_id || candidate.id;
  const [{ data: root }, { data: related }] = await Promise.all([
    rootId === candidate.id
      ? { data: candidate }
      : (await agencyDb()).from("candidates").select("id, talent_pool_at, talent_pool_by, talent_pool_note, talent_pool_status, talent_pool_check_in, talent_pool_expires_at, job_id, match_score, stage, jobs(title, client)").eq("id", rootId).eq("agency_id", agencyId).maybeSingle(),
    (await agencyDb())
      .from("candidates")
      .select("id, job_id, match_score, stage, created_at, jobs(title, client)")
      .eq("agency_id", agencyId)
      .eq("pooled_from_id", rootId)
      .order("created_at", { ascending: false }),
  ]);
  const otherRoles = [...(root ? [root] : []), ...(related ?? [])]
    .filter((r) => r.id !== candidate.id && r.job_id)
    .map((r) => ({ candidateId: r.id, jobId: r.job_id, jobTitle: r.jobs?.title || "Role", client: r.jobs?.client ?? null, score: r.match_score, stage: r.stage }));

  // Candidates screened before match_summary/strengths/concerns were
  // written fall back to their latest analysis.
  const blind = latestScore?.result?.blind_mode === true;
  const fallback = latestScore?.result ? matchHighlights(latestScore.result) : null;
  const matchSummary = candidate.match_summary || fallback?.match_summary || null;
  const strengths = candidate.strengths?.length ? candidate.strengths : fallback?.strengths ?? [];
  const concerns = candidate.concerns?.length ? candidate.concerns : fallback?.concerns ?? [];

  return {
    status: 200,
    body: {
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
      subStage: candidate.sub_stage ?? null,
      customFields: candidate.custom_fields ?? {},
      score: candidate.match_score,
      matchSummary,
      strengths,
      concerns,
      skills: extracted.skills ?? [],
      education: toEducation(extracted),
      workHistory: toWorkHistory(extracted),
      // The original file (lib/candidates/files.js) - null for candidates
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
      talentPool: root?.talent_pool_at
        ? {
            savedAt: root.talent_pool_at,
            savedBy: root.talent_pool_by,
            note: root.talent_pool_note,
            status: root.talent_pool_status,
            checkIn: root.talent_pool_check_in,
            expiresAt: root.talent_pool_expires_at,
          }
        : null,
      otherRoles,
      nextAction: candidate.next_action,
      source: candidate.source,
      rejectionReason: candidate.rejection_reason,
      placementFee: (await getAccess(auth)).canSeeFinancials ? candidate.placement_fee : null,
      placementCost: (await getAccess(auth)).canSeeFinancials ? candidate.placement_cost : null,
      retention30d: candidate.retention_30d,
      retention90d: candidate.retention_90d,
      createdAt: candidate.created_at,
      lastActivityAt: candidate.last_activity_at,
      notes: (notes ?? []).map((n) => ({ id: n.id, author: n.author_name, authorId: n.author_id, createdAt: n.created_at, body: n.note, pinnedAt: n.pinned_at ?? null })),
      activity: (activity ?? []).map((a) => ({ id: a.id, type: a.type, actor: a.actor, meta: a.meta, timestamp: a.created_at })),
    },
  };
}
