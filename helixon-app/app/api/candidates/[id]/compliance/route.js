import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { loadCandidate, readCheckBody } from "@/lib/compliance-server";
import { CHECK_KINDS, CHECK_STATUSES, cleanCheck, privacyNoticeStatus, toCheck, toReference } from "@/lib/compliance";
import { storeComplianceDocument } from "@/lib/compliance-files";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// A candidate's compliance record (lib/compliance.js).
//
// GET    their checks, references and where their privacy notice stands
// POST   add a check - JSON, or multipart form fields plus a `document`
//        file (a scan of what was checked)

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id, "id, created_at, source, consent_given_at, consent_source, privacy_notice_sent_at");
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: checks }, { data: refs }] = await Promise.all([
    (await agencyDb()).from("compliance_checks").select("*").eq("candidate_id", c.id).eq("agency_id", auth.agencyId).order("created_at", { ascending: false }),
    (await agencyDb()).from("candidate_references").select("*").eq("candidate_id", c.id).eq("agency_id", auth.agencyId).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({
    checks: (checks ?? []).map(toCheck),
    references: (refs ?? []).map(toReference),
    privacy: {
      consentGivenAt: c.consent_given_at,
      consentSource: c.consent_source,
      noticeSentAt: c.privacy_notice_sent_at,
      due: privacyNoticeStatus(c),
    },
  });
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, file } = await readCheckBody(request);
  const fields = cleanCheck(body, { creating: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  if (fields.status === "verified" && !fields.checked_by) fields.checked_by = actor;

  let doc = null;
  if (file) {
    doc = await storeComplianceDocument({ agencyId: auth.agencyId, candidateId: c.id, file });
    if (doc.error) return NextResponse.json({ error: doc.error }, { status: 400 });
  }
  const { data, error } = await (await agencyDb())
    .from("compliance_checks")
    .insert({
      ...fields,
      agency_id: auth.agencyId,
      candidate_id: c.id,
      created_by: auth.userId,
      ...(doc ? { document_path: doc.path, document_name: doc.name, document_mime: doc.mime } : {}),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the check." }, { status: 500 });
  await logActivity(supabase, c.id, "compliance_check", actor, {
    note: `${data.label || CHECK_KINDS[data.kind]}: ${CHECK_STATUSES[data.status]}${data.expires_on ? ` (expires ${data.expires_on})` : ""}`,
  });
  return NextResponse.json({ check: toCheck(data) }, { status: 201 });
}
