import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanLine } from "@/lib/sanitize";
import { loadCandidate } from "@/lib/compliance-server";
import { sendPrivacyNotices } from "@/lib/compliance-email";

// POST { action: "send" }   email them the agency's privacy notice
// POST { action: "consent", source }   record consent given another way
//      (on a call, in person, by email) - e.g. to stay in the talent pool
// POST { action: "withdraw" }   they withdrew consent

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const c = await loadCandidate(auth.agencyId, (await params).id, "id, full_name, name, email");
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const actor = recruiterDisplayName(auth.profile) || auth.userId;

  if (body.action === "send") {
    if (!c.email) return NextResponse.json({ error: "They have no email address on file." }, { status: 400 });
    const r = await sendPrivacyNotices({ agencyId: auth.agencyId, profile: auth.profile, actor, recruiterName: recruiterDisplayName(auth.profile), candidates: [c] });
    if (!r.sent) return NextResponse.json({ error: "The email couldn't be sent." }, { status: 502 });
    return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
  }
  if (body.action === "consent") {
    const source = cleanLine(body.source, 60) || "recorded by recruiter";
    const at = new Date().toISOString();
    const { error } = await supabase.from("candidates").update({ consent_given_at: at, consent_source: source }).eq("id", c.id).eq("agency_id", auth.agencyId);
    if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
    await logActivity(supabase, c.id, "consent_recorded", actor, { note: source });
    return NextResponse.json({ ok: true, consentGivenAt: at, consentSource: source });
  }
  if (body.action === "withdraw") {
    const { error } = await supabase.from("candidates").update({ consent_given_at: null, consent_source: null }).eq("id", c.id).eq("agency_id", auth.agencyId);
    if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
    await logActivity(supabase, c.id, "consent_withdrawn", actor, { note: "Consent withdrawn" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
