import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanInterviewFields, formatInterviewTime, INTERVIEW_OUTCOMES, INTERVIEW_STATUSES } from "@/lib/interviews";
import { INTERVIEW_SELECT, inviteRecipients, loadInterview, shapeInterview } from "@/lib/interview-access";
import { sendInterviewInvites } from "@/lib/interview-invites";
import { agencyDb } from "@/lib/agency-db";

// One interview.
//
// GET                    with its scorecards (and links for pending ones)
// PATCH { ...fields, notify? }
//     Reschedule / edit / set status and outcome. A change to the time,
//     length, place or format of an interview that was already sent out
//     re-sends the invite (same calendar event, updated) when notify is
//     true; cancelling sends a cancellation the same way.

const TIMING = ["starts_at", "duration_minutes", "location", "kind"];

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const interview = await loadInterview(auth.agencyId, id);
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await (await agencyDb()).from("interview_feedback").select("*").eq("interview_id", interview.id).order("created_at");
  return NextResponse.json({ interview: shapeInterview({ ...interview, interview_feedback: data ?? [] }, new Map(), { includeTokens: true }) });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const interview = await loadInterview(auth.agencyId, id);
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const fields = cleanInterviewFields(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (fields.contact_id) {
    const { data: c } = await (await agencyDb()).from("client_contacts").select("id").eq("id", fields.contact_id).eq("agency_id", auth.agencyId).maybeSingle();
    if (!c) return NextResponse.json({ error: "That contact wasn't found." }, { status: 400 });
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const timingChanged = TIMING.some((k) => k in fields && String(fields[k] ?? "") !== String(interview[k] ?? ""));
  const cancelling = fields.status === "cancelled" && interview.status !== "cancelled";
  const notify = body.notify === true && interview.invited_at && (timingChanged || cancelling);
  const update = { ...fields, updated_at: new Date().toISOString() };
  if (notify) update.ics_sequence = (interview.ics_sequence ?? 0) + 1;

  const { error } = await (await agencyDb()).from("interviews").update(update).eq("id", interview.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to update the interview." }, { status: 500 });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const fresh = await loadInterview(auth.agencyId, interview.id);
  if (timingChanged && !cancelling) {
    await logActivity(supabase, interview.candidate_id, "interview_rescheduled", actor, { note: formatInterviewTime(fresh.starts_at, fresh.duration_minutes) });
  }
  if (fields.status && fields.status !== interview.status) {
    await logActivity(supabase, interview.candidate_id, "interview_status", actor, { note: `Round ${fresh.round}: ${INTERVIEW_STATUSES[fields.status]}` });
  }
  if (fields.outcome && fields.outcome !== interview.outcome) {
    await logActivity(supabase, interview.candidate_id, "interview_outcome", actor, { note: `Round ${fresh.round}: ${INTERVIEW_OUTCOMES[fields.outcome]}` });
  }

  let invites = null;
  if (notify) {
    const recipients = inviteRecipients(fresh);
    invites = await sendInterviewInvites({ auth, interview: fresh, candidate: fresh.candidates, job: fresh.jobs, recipients, method: cancelling ? "CANCEL" : "UPDATE" });
  }

  const { data } = await (await agencyDb()).from("interviews").select(`${INTERVIEW_SELECT}, interview_feedback(*)`).eq("id", interview.id).single();
  return NextResponse.json({ interview: shapeInterview(data, new Map(), { includeTokens: true }), invites });
}
