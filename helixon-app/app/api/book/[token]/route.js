import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { emitWebhook } from "@/lib/webhooks";
import { logActivity } from "@/lib/candidates/activity";
import { logClientActivity } from "@/lib/clients";
import { notify } from "@/lib/notifications";
import { TOKEN_RE } from "@/lib/signatures";
import { openSlots } from "@/lib/interview-booking";
import { INTERVIEW_KINDS, formatInterviewTime } from "@/lib/interviews";
import { inviteRecipients, loadInterview, shapeInterview } from "@/lib/interview-access";
import { sendInterviewInvites } from "@/lib/interview-invites";
import { FUNNEL_ORDER } from "@/lib/stage-labels";

// Public: a candidate picks an interview time (app/book/[token]). The token
// is the only credential. Picking books the interview, moves the candidate
// to Interview, and sends calendar invites to them and the hiring contact.

async function load(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data } = await supabase
    .from("interview_booking_links")
    .select("*, agencies(name), candidates(id, full_name, name, stage, recruiter_id), jobs(title, client)")
    .eq("token", token)
    .maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`book-get:${getClientIp(request)}`, 120))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const link = await load(token);
  if (!link) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  let booked = null;
  if (link.status === "booked" && link.interview_id) {
    const { data: iv } = await supabase.from("interviews").select("starts_at, duration_minutes, status").eq("id", link.interview_id).maybeSingle();
    if (iv) booked = { startsAt: iv.starts_at, durationMinutes: iv.duration_minutes, cancelled: iv.status === "cancelled" };
  }
  return NextResponse.json({
    agencyName: link.agencies?.name ?? null,
    firstName: (link.candidates?.full_name || link.candidates?.name || "").split(" ")[0] || null,
    jobTitle: link.jobs?.title ?? null,
    kind: INTERVIEW_KINDS[link.kind],
    durationMinutes: link.duration_minutes,
    location: link.kind === "in_person" ? link.location : null,
    status: link.status,
    slots: openSlots(link),
    booked,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`book-post:${getClientIp(request)}`, 20))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const link = await load(token);
  if (!link || !link.candidates) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const pick = typeof body.startsAt === "string" ? new Date(body.startsAt).toISOString() : null;
  const available = openSlots(link).map((s) => new Date(s).toISOString());
  if (link.status !== "open") return NextResponse.json({ error: "A time has already been booked on this link." }, { status: 409 });
  if (!pick || !available.includes(pick)) return NextResponse.json({ error: "That time isn't available any more - please pick another." }, { status: 409 });

  // Claim the link first so two clicks can't book twice.
  const { data: claimed } = await supabase
    .from("interview_booking_links")
    .update({ status: "booked", booked_at: new Date().toISOString() })
    .eq("id", link.id)
    .eq("status", "open")
    .select("id");
  if (!claimed?.length) return NextResponse.json({ error: "A time has already been booked on this link." }, { status: 409 });

  let round = link.round;
  if (!round) {
    const { count } = await supabase.from("interviews").select("id", { count: "exact", head: true }).eq("candidate_id", link.candidate_id).neq("status", "cancelled");
    round = Math.min(20, (count ?? 0) + 1);
  }
  const { data: created, error } = await supabase
    .from("interviews")
    .insert({
      agency_id: link.agency_id,
      candidate_id: link.candidate_id,
      job_id: link.job_id,
      contact_id: link.contact_id,
      round,
      kind: link.kind,
      starts_at: pick,
      duration_minutes: link.duration_minutes,
      location: link.location,
      interviewers: link.interviewers,
      notes: "Booked by the candidate from a booking link.",
      created_by: link.created_by,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.from("interview_booking_links").update({ status: "open", booked_at: null }).eq("id", link.id);
    return NextResponse.json({ error: "Couldn't book that time - please try again." }, { status: 500 });
  }
  await supabase.from("interview_booking_links").update({ interview_id: created.id }).eq("id", link.id);

  const who = link.candidates.full_name || link.candidates.name || "Candidate";
  const when = formatInterviewTime(pick, link.duration_minutes);
  await logActivity(supabase, link.candidate_id, "interview_scheduled", who, { note: `Round ${round} · ${when} (booked by the candidate)`, interview_id: created.id });
  const stageIdx = FUNNEL_ORDER.indexOf(link.candidates.stage);
  if (link.candidates.stage !== "Rejected" && stageIdx < FUNNEL_ORDER.indexOf("Interview")) {
    await supabase.from("candidates").update({ stage: "Interview" }).eq("id", link.candidate_id).eq("agency_id", link.agency_id);
    await logActivity(supabase, link.candidate_id, "stage_changed", who, { from: link.candidates.stage, to: "Interview" });
  }

  const interview = await loadInterview(link.agency_id, created.id);
  if (interview?.jobs?.client_id) await logClientActivity(link.agency_id, interview.jobs.client_id, "interview_scheduled", who, { note: `${who} · ${when}` });

  // Invites go out as if from the recruiter who offered the times.
  const { data: profile } = link.created_by
    ? await supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("clerk_user_id", link.created_by).maybeSingle()
    : { data: null };
  if (interview) {
    const recipients = inviteRecipients(interview);
    if (recipients.length) {
      const invites = await sendInterviewInvites({ auth: { agencyId: link.agency_id, profile }, interview, candidate: interview.candidates, job: interview.jobs, recipients }).catch(() => ({ sent: [] }));
      if (invites.sent.length) await supabase.from("interviews").update({ invited_at: new Date().toISOString() }).eq("id", interview.id);
    }
  }
  await notify({
    agencyId: link.agency_id,
    userId: link.created_by || link.candidates.recruiter_id,
    kind: "interview_booked",
    title: `${who} booked an interview`,
    body: `${when}${link.jobs?.title ? ` · ${link.jobs.title}` : ""}`,
    href: `/dashboard/candidates/${link.candidate_id}`,
  });
  if (interview) after(() => emitWebhook(link.agency_id, "interview.booked", shapeInterview(interview)));
  return NextResponse.json({ ok: true, startsAt: pick, durationMinutes: link.duration_minutes });
}
