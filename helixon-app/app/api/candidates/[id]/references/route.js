import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanReferee, toReference } from "@/lib/compliance";
import { loadCandidate } from "@/lib/compliance-server";
import { referenceRequestEmail, referenceUrl } from "@/lib/compliance-email";
import { agencyFromName, sendAgencyEmail } from "@/lib/mailer";

// POST { refereeName, refereeEmail?, refereeCompany?, refereeTitle?,
//        refereePhone?, relationship?, send? } - add a referee and, when
//        send and there's an email, email them the reference form link.
// The link works for 30 days.

const LINK_DAYS = 30;

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const c = await loadCandidate(auth.agencyId, (await params).id, "id, full_name, name");
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const referee = cleanReferee(body);
  if (referee.error) return NextResponse.json({ error: referee.error }, { status: 400 });
  const send = body.send !== false && Boolean(referee.referee_email);
  const now = new Date();

  const { data, error } = await supabase
    .from("candidate_references")
    .insert({
      ...referee,
      agency_id: auth.agencyId,
      candidate_id: c.id,
      token: crypto.randomBytes(24).toString("hex"),
      status: "requested",
      requested_at: send ? now.toISOString() : null,
      expires_at: new Date(now.getTime() + LINK_DAYS * 86400000).toISOString(),
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the referee." }, { status: 500 });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  let emailError = null;
  if (send) {
    const mail = referenceRequestEmail({
      agencyName: await agencyFromName(auth.agencyId, auth.profile),
      refereeName: data.referee_name,
      candidateName: c.full_name || c.name || "A candidate",
      url: referenceUrl(data.token),
      recruiterName: recruiterDisplayName(auth.profile),
    });
    const res = await sendAgencyEmail({ agencyId: auth.agencyId, profile: auth.profile, to: data.referee_email, subject: mail.subject, text: mail.text });
    emailError = res.error || null;
    if (emailError) await supabase.from("candidate_references").update({ requested_at: null }).eq("id", data.id);
  }
  await logActivity(supabase, c.id, "reference_requested", actor, {
    note: `${data.referee_name}${data.referee_company ? `, ${data.referee_company}` : ""}${send && !emailError ? " (emailed)" : ""}`,
  });
  return NextResponse.json(
    { reference: toReference({ ...data, requested_at: emailError ? null : data.requested_at }), link: referenceUrl(data.token), emailError },
    { status: 201 }
  );
}
