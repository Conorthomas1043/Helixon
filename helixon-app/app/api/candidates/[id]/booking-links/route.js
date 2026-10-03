import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { agencyFromName, sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { newToken } from "@/lib/signatures";
import { cleanBookingRequest, openSlots } from "@/lib/interview-booking";
import { formatInterviewTime } from "@/lib/interviews";
import { candidateHidden } from "@/lib/permissions";

// Interview booking links for one candidate (lib/interview-booking.js).
// GET                    the candidate's open and recent links
// POST { slots, durationMinutes, kind, location?, interviewers?, round?,
//        contactId?, expiresInDays?, send? }   offer times; with send,
//                        email the link to the candidate
// DELETE ?linkId=        cancel an open link

async function loadCandidate(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("candidates").select("id, full_name, name, email, job_id, jobs(title, contact_id)").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

const toLink = (row) => ({
  id: row.id,
  url: `${siteUrl()}/book/${row.token}`,
  status: row.status,
  slots: row.slots,
  openSlots: openSlots(row),
  durationMinutes: row.duration_minutes,
  kind: row.kind,
  interviewId: row.interview_id,
  bookedAt: row.booked_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase.from("interview_booking_links").select("*").eq("candidate_id", c.id).order("created_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ links: [], unavailable: true });
  return NextResponse.json({ links: (data ?? []).map(toLink) });
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) ?? {};
  const offer = cleanBookingRequest(body);
  if (offer.error) return NextResponse.json({ error: offer.error }, { status: 400 });
  if (offer.contact_id) {
    const { data: contact } = await supabase.from("client_contacts").select("id").eq("id", offer.contact_id).eq("agency_id", auth.agencyId).maybeSingle();
    if (!contact) return NextResponse.json({ error: "That contact wasn't found." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("interview_booking_links")
    .insert({
      ...offer,
      contact_id: offer.contact_id ?? c.jobs?.contact_id ?? null,
      agency_id: auth.agencyId,
      candidate_id: c.id,
      job_id: c.job_id,
      token: newToken(),
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Booking links need a database update first (migration 20261003010000)." }, { status: 503 });

  const link = toLink(data);
  let emailError = null;
  if (body.send === true) {
    if (!c.email) emailError = "There's no email address for this candidate.";
    else {
      const agencyName = await agencyFromName(auth.agencyId, auth.profile);
      const first = (c.full_name || c.name || "").split(" ")[0];
      const res = await sendAgencyEmail({
        agencyId: auth.agencyId,
        profile: auth.profile,
        to: c.email,
        subject: `Pick a time for your interview${c.jobs?.title ? ` - ${c.jobs.title}` : ""}`,
        text: [
          `Hi ${first || "there"},`,
          "",
          `Good news - we'd like to set up your interview${c.jobs?.title ? ` for ${c.jobs.title}` : ""}. Pick whichever of these times suits you:`,
          "",
          ...offer.slots.map((s) => `- ${formatInterviewTime(s, offer.duration_minutes)}`),
          "",
          link.url,
          "",
          "Times are first come, first served, so please choose soon.",
          "",
          recruiterDisplayName(auth.profile) || agencyName,
        ].join("\n"),
      });
      emailError = res.error || null;
    }
  }
  await logActivity(supabase, c.id, "booking_link_created", recruiterDisplayName(auth.profile) || auth.userId, {
    note: `${offer.slots.length} interview time${offer.slots.length === 1 ? "" : "s"} offered${body.send === true && !emailError ? " (emailed)" : ""}`,
  });
  return NextResponse.json({ link, emailError }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const linkId = cleanUuid(new URL(request.url).searchParams.get("linkId"));
  if (!linkId) return NextResponse.json({ error: "Which link?" }, { status: 400 });
  await supabase.from("interview_booking_links").update({ status: "cancelled" }).eq("id", linkId).eq("candidate_id", c.id).eq("status", "open");
  return NextResponse.json({ ok: true });
}
