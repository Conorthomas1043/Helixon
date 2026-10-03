import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanUuid } from "@/lib/sanitize";
import { CHECK_KINDS, CHECK_STATUSES, cleanCheck, toCheck } from "@/lib/compliance";
import { complianceDocumentUrl, removeComplianceDocuments, storeComplianceDocument } from "@/lib/compliance-files";
import { readCheckBody } from "@/lib/compliance-server";
import { candidateHidden } from "@/lib/permissions";

// One compliance check.
// GET     a one-minute download link for its document: { url }
// PATCH   update it (JSON, or multipart with a replacement `document`;
//         removeDocument=true deletes the stored copy)
// DELETE  remove it and its document

async function load(auth, params) {
  const { id, checkId } = await params;
  const candidateId = cleanUuid(id);
  const cid = cleanUuid(checkId);
  if (!candidateId || !cid) return null;
  const { data } = await supabase.from("compliance_checks").select("*").eq("id", cid).eq("candidate_id", candidateId).eq("agency_id", auth.agencyId).maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const check = await load(auth, params);
  if (!check?.document_path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json({ url: await complianceDocumentUrl(check.document_path, check.document_name) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The document couldn't be opened." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const check = await load(auth, params);
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, file } = await readCheckBody(request);
  const fields = cleanCheck(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  if (fields.status === "verified" && check.status !== "verified" && fields.checked_by === undefined) fields.checked_by = actor;

  let oldPath = null;
  if (file) {
    const doc = await storeComplianceDocument({ agencyId: auth.agencyId, candidateId: check.candidate_id, file });
    if (doc.error) return NextResponse.json({ error: doc.error }, { status: 400 });
    Object.assign(fields, { document_path: doc.path, document_name: doc.name, document_mime: doc.mime });
    oldPath = check.document_path;
  } else if (body.removeDocument === true || body.removeDocument === "true") {
    Object.assign(fields, { document_path: null, document_name: null, document_mime: null });
    oldPath = check.document_path;
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabase
    .from("compliance_checks")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", check.id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  if (oldPath) await removeComplianceDocuments([oldPath]);
  if (fields.status && fields.status !== check.status) {
    await logActivity(supabase, check.candidate_id, "compliance_check", actor, { note: `${data.label || CHECK_KINDS[data.kind]}: ${CHECK_STATUSES[data.status]}` });
  }
  return NextResponse.json({ check: toCheck(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const check = await load(auth, params);
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from("compliance_checks").delete().eq("id", check.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  if (check.document_path) await removeComplianceDocuments([check.document_path]);
  return NextResponse.json({ ok: true });
}
