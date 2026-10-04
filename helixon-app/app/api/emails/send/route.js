import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { rateLimit } from "@/lib/ratelimit";
import { cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";
import { mergeContext, renderTemplate } from "@/lib/email-merge";
import { loadEmailTargets } from "@/lib/email-targets";
import { agencyFromName, mailConfigured, senderEmail } from "@/lib/mailer";
import { sendTrackedEmail } from "@/lib/tracked-email";
import { agencyDb } from "@/lib/agency-db";

// Email one or many candidates, each with the merge fields filled in for
// them (lib/email-merge.js). Every email is sent separately - nobody sees
// anyone else's address - and kept on each candidate's thread.
//
// POST { candidateIds, subject, body, templateId?, preview? }
//   preview: true answers with the rendered emails (and any merge fields
//   that came out empty) without sending anything.

const MAX_PER_REQUEST = 100;
const MAX_PER_HOUR = 400;

export async function POST(request) {
  const auth = await requireCustomerContext({ requireSubscription: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error, upgrade: auth.upgrade }, { status: auth.status });
  const body = await request.json().catch(() => ({}));

  const ids = [...new Set((Array.isArray(body.candidateIds) ? body.candidateIds : []).map(cleanUuid).filter(Boolean))];
  if (ids.length === 0) return NextResponse.json({ error: "Choose who to email." }, { status: 400 });
  if (ids.length > MAX_PER_REQUEST) return NextResponse.json({ error: `Email up to ${MAX_PER_REQUEST} people at a time.` }, { status: 400 });
  const subject = cleanLine(body.subject, 300);
  const text = cleanText(body.body, { max: 20000 });
  if (!subject || !text) return NextResponse.json({ error: "Add a subject and a message." }, { status: 400 });
  const templateId = body.templateId ? cleanUuid(body.templateId) : null;

  const [targets, agencyName] = await Promise.all([loadEmailTargets(auth.agencyId, ids), agencyFromName(auth.agencyId, auth.profile)]);
  if (targets.length !== ids.length) return NextResponse.json({ error: "Some of those candidates weren't found." }, { status: 404 });

  const rendered = targets.map((c) => {
    const ctx = mergeContext({ candidate: c, job: c.jobs, contact: c.jobs?.client_contacts, recruiter: auth.profile, agencyName });
    const s = renderTemplate(subject, ctx);
    const b = renderTemplate(text, ctx);
    return {
      candidateId: c.id,
      name: c.full_name || c.name || "Candidate",
      email: c.email || null,
      subject: s.text,
      body: b.text,
      missing: [...new Set([...s.missing, ...b.missing])],
    };
  });

  if (body.preview) {
    return NextResponse.json({ emails: rendered, sendable: rendered.filter((r) => r.email).length });
  }

  if (!mailConfigured()) return NextResponse.json({ error: "Email isn't set up yet." }, { status: 503 });
  const sendable = rendered.filter((r) => r.email);
  if (!(await rateLimit(`bulk-email:${auth.userId}`, MAX_PER_HOUR))) {
    return NextResponse.json({ error: "You've sent a lot of emails in the last hour - try again later." }, { status: 429 });
  }

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const recruiterEmail = await senderEmail();
  const sent = [];
  const failed = [];
  for (const r of sendable) {
    const res = await sendTrackedEmail({
      agencyId: auth.agencyId,
      profile: auth.profile,
      actor,
      sentBy: auth.userId,
      candidateId: r.candidateId,
      to: r.email,
      subject: r.subject,
      body: r.body,
      templateId,
      recruiterEmail,
      fromName: agencyName,
    });
    (res.error ? failed : sent).push(r.candidateId);
  }
  if (templateId && sent.length) {
    const { data: t } = await (await agencyDb()).from("email_templates").select("uses").eq("id", templateId).eq("agency_id", auth.agencyId).maybeSingle();
    if (t) await (await agencyDb()).from("email_templates").update({ uses: (t.uses ?? 0) + sent.length }).eq("id", templateId).eq("agency_id", auth.agencyId);
  }
  return NextResponse.json({
    sent: sent.length,
    failed: failed.length,
    skippedNoEmail: rendered.filter((r) => !r.email).map((r) => r.name),
  });
}
