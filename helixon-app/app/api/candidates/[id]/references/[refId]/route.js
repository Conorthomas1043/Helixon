import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { toReference } from "@/lib/compliance";
import { referenceRequestEmail, referenceUrl } from "@/lib/compliance-email";
import { agencyFromName, sendAgencyEmail } from "@/lib/mailer";

// One reference.
// GET     { reference, link } - the link, to copy and send yourself
// PATCH   { action: "resend" }   email the referee again (renews the link)
//         { action: "taken", notes }   a reference taken by phone
//         { action: "declined" }   the referee won't give one
// DELETE  remove it

async function load(auth, params) {
  const { id, refId } = await params;
  const candidateId = cleanUuid(id);
  const rid = cleanUuid(refId);
  if (!candidateId || !rid) return null;
  const { data } = await supabase
    .from("candidate_references")
    .select("*, candidates(full_name, name)")
    .eq("id", rid)
    .eq("candidate_id", candidateId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const ref = await load(auth, params);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ reference: toReference(ref), link: referenceUrl(ref.token) });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const ref = await load(auth, params);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const now = new Date();
  let update;
  let note;

  if (body.action === "resend") {
    if (ref.status !== "requested") return NextResponse.json({ error: "They've already answered." }, { status: 409 });
    if (!ref.referee_email) return NextResponse.json({ error: "There's no email address for this referee." }, { status: 400 });
    const mail = referenceRequestEmail({
      agencyName: await agencyFromName(auth.agencyId, auth.profile),
      refereeName: ref.referee_name,
      candidateName: ref.candidates?.full_name || ref.candidates?.name || "A candidate",
      url: referenceUrl(ref.token),
      recruiterName: recruiterDisplayName(auth.profile),
      reminder: Boolean(ref.requested_at),
    });
    const res = await sendAgencyEmail({ agencyId: auth.agencyId, profile: auth.profile, to: ref.referee_email, subject: mail.subject, text: mail.text });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 502 });
    update = { requested_at: now.toISOString(), expires_at: new Date(now.getTime() + 30 * 86400000).toISOString() };
    note = `Emailed ${ref.referee_name}`;
  } else if (body.action === "taken") {
    const notes = cleanText(body.notes, { max: 4000 });
    if (!notes) return NextResponse.json({ error: "Add what the referee said." }, { status: 400 });
    update = { status: "received", received_at: now.toISOString(), answers: { comments: notes, completedBy: ref.referee_name, takenBy: actor, method: "phone" } };
    note = `${ref.referee_name}: taken by phone`;
  } else if (body.action === "declined") {
    update = { status: "declined", received_at: now.toISOString() };
    note = `${ref.referee_name}: declined`;
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { data, error } = await supabase.from("candidate_references").update(update).eq("id", ref.id).eq("agency_id", auth.agencyId).select("*").single();
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logActivity(supabase, ref.candidate_id, body.action === "resend" ? "reference_requested" : "reference_received", actor, { note });
  return NextResponse.json({ reference: toReference(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const ref = await load(auth, params);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await supabase.from("candidate_references").delete().eq("id", ref.id).eq("agency_id", auth.agencyId);
  return NextResponse.json({ ok: true });
}
