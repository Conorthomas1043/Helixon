import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { InterviewInput } from "@/lib/api/schemas";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidates/activity";
import { logClientActivity } from "@/lib/clients";
import { cleanEmail, cleanUuid } from "@/lib/sanitize";
import { cleanInterviewFields, formatInterviewTime } from "@/lib/interviews";
import { INTERVIEW_SELECT, inviteRecipients, loadInterview, shapeInterview } from "@/lib/interview-access";
import { sendInterviewInvites } from "@/lib/interview-invites";
import { FUNNEL_ORDER } from "@/lib/stage-labels";
import { getAccess } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// Interviews (lib/interviews.js).
//
// GET ?candidateId=&jobId=&from=&to=&scope=mine|all   list, soonest first,
//     with candidate, job, contact and a scorecard summary
// POST { candidateId, startsAt, durationMinutes?, kind?, round?, location?,
//        interviewers?, notes?, contactId?, invite?: { candidate, contact,
//        extra: [emails] }, moveToInterview? }
//     schedule one. Moves the candidate to the Interview stage if they're
//     earlier in the funnel (unless moveToInterview is false) and emails
//     calendar invites.

export const GET = customerRoute(async (request, _context, auth) => {
  const params = new URL(request.url).searchParams;

  let query = (await agencyDb())
    .from("interviews")
    .select(`${INTERVIEW_SELECT}, interview_feedback(*)`)
    .eq("agency_id", auth.agencyId)
    .order("starts_at", { ascending: true })
    .limit(500);
  const candidateId = cleanUuid(params.get("candidateId"));
  const jobId = cleanUuid(params.get("jobId"));
  if (candidateId) query = query.eq("candidate_id", candidateId);
  if (jobId) query = query.eq("job_id", jobId);
  const from = params.get("from");
  const to = params.get("to");
  if (from && !Number.isNaN(Date.parse(from))) query = query.gte("starts_at", new Date(from).toISOString());
  if (to && !Number.isNaN(Date.parse(to))) query = query.lt("starts_at", new Date(to).toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load interviews." }, { status: 500 });

  const access = await getAccess(auth);
  let rows = (data ?? []).filter((r) => access.seesAllCandidates || !r.candidates?.recruiter_id || r.candidates.recruiter_id === auth.userId);
  if (params.get("scope") === "mine") rows = rows.filter((r) => r.candidates?.recruiter_id === auth.userId || r.created_by === auth.userId);
  const names = await resolveRecruiterNames(supabase, rows.map((r) => r.candidates?.recruiter_id));
  return NextResponse.json({ interviews: rows.map((r) => shapeInterview(r, names)) });
});

export const POST = customerRoute(async (request, _context, auth, body) => {

  const candidateId = cleanUuid(body.candidateId);
  if (!candidateId) return NextResponse.json({ error: "Which candidate?" }, { status: 400 });
  const { data: candidate } = await (await agencyDb())
    .from("candidates")
    .select("id, stage, job_id, jobs(id, client_id, contact_id)")
    .eq("id", candidateId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = cleanInterviewFields(body, { creating: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  // The hiring contact defaults to the job's; one given must be the agency's.
  if (fields.contact_id === undefined) fields.contact_id = candidate.jobs?.contact_id ?? null;
  if (fields.contact_id) {
    const { data: c } = await (await agencyDb()).from("client_contacts").select("id").eq("id", fields.contact_id).eq("agency_id", auth.agencyId).maybeSingle();
    if (!c) return NextResponse.json({ error: "That contact wasn't found." }, { status: 400 });
  }
  if (fields.round === undefined) {
    const { count } = await (await agencyDb()).from("interviews").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId).neq("status", "cancelled");
    fields.round = Math.min(20, (count ?? 0) + 1);
  }

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const { data: created, error } = await (await agencyDb())
    .from("interviews")
    .insert({ ...fields, agency_id: auth.agencyId, candidate_id: candidateId, job_id: candidate.job_id, created_by: auth.userId })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Failed to schedule the interview." }, { status: 500 });

  const interview = await loadInterview(auth.agencyId, created.id);
  const when = formatInterviewTime(interview.starts_at, interview.duration_minutes);
  await logActivity(supabase, candidateId, "interview_scheduled", actor, { note: `Round ${interview.round} · ${when}`, interview_id: interview.id });
  if (interview.jobs?.client_id) {
    await logClientActivity(auth.agencyId, interview.jobs.client_id, "interview_scheduled", actor, {
      note: `${interview.candidates?.full_name || "Candidate"} · ${when}`,
    });
  }

  // Into the Interview stage, unless they're already there or further on.
  const stageIdx = FUNNEL_ORDER.indexOf(candidate.stage);
  const interviewIdx = FUNNEL_ORDER.indexOf("Interview");
  if (body.moveToInterview !== false && candidate.stage !== "Rejected" && stageIdx < interviewIdx) {
    await (await agencyDb()).from("candidates").update({ stage: "Interview" }).eq("id", candidateId).eq("agency_id", auth.agencyId);
    await logActivity(supabase, candidateId, "stage_changed", actor, { from: candidate.stage, to: "Interview" });
  }

  let invites = { sent: [], failed: [] };
  const invite = body.invite || {};
  const extra = (Array.isArray(invite.extra) ? invite.extra : []).map(cleanEmail).filter(Boolean).slice(0, 10);
  const recipients = inviteRecipients(interview, { candidate: invite.candidate !== false, contact: invite.contact !== false, extra });
  if (recipients.length && body.sendInvites !== false) {
    invites = await sendInterviewInvites({ auth, interview, candidate: interview.candidates, job: interview.jobs, recipients });
    if (invites.sent.length) {
      await (await agencyDb()).from("interviews").update({ invited_at: new Date().toISOString() }).eq("id", interview.id);
      await logActivity(supabase, candidateId, "interview_invite_sent", actor, { note: `Invite sent to ${invites.sent.join(", ")}` });
    }
  }

  const fresh = await (await agencyDb()).from("interviews").select(`${INTERVIEW_SELECT}, interview_feedback(*)`).eq("id", interview.id).single();
  const shaped = shapeInterview(fresh.data);
  after(() => emitWebhook(auth.agencyId, "interview.scheduled", shaped));
  return NextResponse.json({ interview: shaped, invites }, { status: 201 });
}, { body: InterviewInput, optionalBody: true });
