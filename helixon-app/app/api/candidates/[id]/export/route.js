import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { personCandidateIds } from "@/lib/candidate-person";
import { getAgencyTags } from "@/lib/agency-tags";

// GET - everything the agency holds about one person, as a JSON file, for
// a subject access or data portability request (UK GDPR Arts. 15 and 20).
// Covers every candidate row for the person (they get one per job they're
// screened for - lib/candidate-person.js) and everything hanging off them:
// analyses, notes, activity, emails drafted or sent, feedback requests,
// shortlists. The original CV file is listed by name; the agency can
// download it from the profile and send it with this file.
//
// Internal-only values are left out: storage paths, the feedback-request
// secret token, other people's user ids.
export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const candidateId = cleanUuid(id);
  const ids = candidateId ? await personCandidateIds(supabase, auth.agencyId, candidateId).catch(() => []) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [candidates, scores, notes, activity, artifacts, feedbackRequests, shortlists, tags] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        "id, full_name, name, email, phone, linkedin, location, current_title, current_company, years_experience, created_at, cv_filename, cv_text, extracted, " +
          "stage, match_score, recommendation, match_summary, strengths, concerns, tags, next_action, last_activity_at, source, rejection_reason, " +
          "retention_30d, retention_90d, talent_pool_at, talent_pool_note, talent_pool_status, talent_pool_check_in, talent_pool_expires_at, pooled_from_id, jobs(title, client)"
      )
      .eq("agency_id", auth.agencyId)
      .in("id", ids),
    supabase.from("scores").select("id, candidate_id, created_at, match_score, recommendation, result, recruiter_feedback, jobs(title, client)").in("candidate_id", ids),
    supabase.from("candidate_notes").select("candidate_id, created_at, author_name, note").eq("agency_id", auth.agencyId).in("candidate_id", ids),
    supabase.from("candidate_activity").select("candidate_id, created_at, type, actor, meta").in("candidate_id", ids).order("created_at"),
    supabase.from("artifacts").select("candidate_id, created_at, kind, content").eq("agency_id", auth.agencyId).in("candidate_id", ids),
    supabase.from("feedback_requests").select("candidate_id, created_at, kind, recipient_label, rating, comment, tags, responded_at").eq("agency_id", auth.agencyId).in("candidate_id", ids),
    supabase.from("shortlist_candidates").select("candidate_id, created_at, note").in("candidate_id", ids),
    getAgencyTags(supabase, auth.agencyId).catch(() => []),
  ]);
  const failed = [candidates, scores, notes, activity, artifacts, feedbackRequests, shortlists].find((r) => r.error);
  if (failed) {
    console.error("[candidate export] Query failed:", failed.error.message);
    return NextResponse.json({ error: "Couldn't gather their data. Please try again." }, { status: 500 });
  }

  const tagLabel = new Map(tags.map((t) => [t.id, t.label]));
  const person = candidates.data[0] || {};
  const exportedAt = new Date().toISOString();
  const body = {
    about: {
      purpose: "Personal data held about this person by the recruitment agency, exported for a subject access / data portability request.",
      exportedAt,
      exportedBy: recruiterDisplayName(auth.profile) || null,
      name: person.full_name || person.name || null,
      records: ids.length,
      note:
        "Each record is this person's application or screening for one job. The original CV file is listed under cvFile and can be downloaded from their profile.",
    },
    records: candidates.data.map((c) => ({
      job: c.jobs ? { title: c.jobs.title, client: c.jobs.client } : null,
      contact: { name: c.full_name || c.name, email: c.email, phone: c.phone, linkedin: c.linkedin, location: c.location },
      currentRole: { title: c.current_title, company: c.current_company, yearsExperience: c.years_experience },
      addedAt: c.created_at,
      lastActivityAt: c.last_activity_at,
      cvFile: c.cv_filename || null,
      cvText: c.cv_text || null,
      extractedFromCv: c.extracted || null,
      assessment: { matchScore: c.match_score, recommendation: c.recommendation, summary: c.match_summary, strengths: c.strengths, concerns: c.concerns },
      pipeline: { stage: c.stage, source: c.source, rejectionReason: c.rejection_reason, nextAction: c.next_action, retention30d: c.retention_30d, retention90d: c.retention_90d },
      tags: (c.tags || []).map((t) => tagLabel.get(t) || t),
      talentPool: c.talent_pool_at
        ? { savedAt: c.talent_pool_at, note: c.talent_pool_note, availability: c.talent_pool_status, checkIn: c.talent_pool_check_in, keptUntil: c.talent_pool_expires_at }
        : null,
      analyses: scores.data
        .filter((s) => s.candidate_id === c.id)
        .map((s) => ({ at: s.created_at, job: s.jobs?.title || null, matchScore: s.match_score, recommendation: s.recommendation, report: s.result, recruiterFeedback: s.recruiter_feedback })),
      notes: notes.data.filter((n) => n.candidate_id === c.id).map((n) => ({ at: n.created_at, by: n.author_name, note: n.note })),
      emailsAndDocuments: artifacts.data.filter((a) => a.candidate_id === c.id).map((a) => ({ at: a.created_at, kind: a.kind, content: a.content })),
      feedbackRequests: feedbackRequests.data
        .filter((f) => f.candidate_id === c.id)
        .map((f) => ({ at: f.created_at, kind: f.kind, recipient: f.recipient_label, rating: f.rating, comment: f.comment, tags: f.tags, respondedAt: f.responded_at })),
      shortlists: shortlists.data.filter((x) => x.candidate_id === c.id).map((x) => ({ at: x.created_at, note: x.note })),
      history: activity.data.filter((a) => a.candidate_id === c.id).map((a) => ({ at: a.created_at, type: a.type, by: a.actor, details: a.meta })),
    })),
  };

  await logActivity(supabase, candidateId, "data_exported", recruiterDisplayName(auth.profile) || auth.userId, {
    note: `Subject access export (${ids.length} record${ids.length === 1 ? "" : "s"})`,
  });

  const safeName = String(body.about.name || "candidate").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "candidate";
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-data-${exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
