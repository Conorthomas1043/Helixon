import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { emitWebhook } from "@/lib/webhooks";
import { logActivity } from "@/lib/candidates/activity";
import { notify } from "@/lib/notifications";
import { storeComplianceDocument } from "@/lib/compliance-files";
import { CHECK_KINDS } from "@/lib/compliance";
import { TOKEN_RE } from "@/lib/signatures";
import { cleanPortalUpdate, portalView } from "@/lib/candidates/portal";

// Public: a candidate's self-service page (app/portal/[token]). The token
// is the only credential. Answers with only the candidate's own editable
// details and the documents they've uploaded - never scores, notes or
// anything the agency wrote about them.
//
// GET                    their details
// POST (JSON)            update their details
// POST (multipart)       upload a document: `kind`, `document`

const CANDIDATE_COLUMNS = "id, agency_id, full_name, name, recruiter_id, phone, location, current_title, current_company, linkedin, notice_period, salary_expectation, available_from";

async function load(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data: link } = await supabase.from("candidate_portal_links").select("id, candidate_id, expires_at, revoked_at, agencies(name)").eq("token", token).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return link ? { link, closed: true } : null;
  const { data: candidate } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", link.candidate_id).maybeSingle();
  if (!candidate) return null;
  return { link, candidate };
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`portal-get:${getClientIp(request)}`, 120))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const found = await load(token);
  if (!found) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (found.closed) return NextResponse.json({ error: "This link has expired - ask the agency for a new one." }, { status: 410 });
  const { link, candidate } = found;
  const { data: docs } = await supabase
    .from("compliance_checks")
    .select("id, kind, document_name, status, created_at")
    .eq("candidate_id", candidate.id)
    .not("document_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(30);
  await supabase.from("candidate_portal_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);
  return NextResponse.json({
    agencyName: link.agencies?.name ?? null,
    firstName: (candidate.full_name || candidate.name || "").split(" ")[0] || null,
    details: portalView(candidate),
    documents: (docs ?? []).map((d) => ({ id: d.id, kind: CHECK_KINDS[d.kind] || "Document", name: d.document_name, status: d.status === "verified" ? "Checked" : "Received", uploadedAt: d.created_at })),
    documentKinds: CHECK_KINDS,
    expiresAt: link.expires_at,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`portal-post:${getClientIp(request)}`, 30))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const found = await load(token);
  if (!found) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (found.closed) return NextResponse.json({ error: "This link has expired - ask the agency for a new one." }, { status: 410 });
  const { link, candidate } = found;
  const who = candidate.full_name || candidate.name || "Candidate";

  if ((request.headers.get("content-type") || "").startsWith("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("document");
    const kind = CHECK_KINDS[form?.get("kind")] ? form.get("kind") : "other";
    if (!file || typeof file === "string") return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const doc = await storeComplianceDocument({ agencyId: candidate.agency_id, candidateId: candidate.id, file });
    if (doc.error) return NextResponse.json({ error: doc.error }, { status: 400 });
    const { error } = await supabase.from("compliance_checks").insert({
      agency_id: candidate.agency_id,
      candidate_id: candidate.id,
      kind,
      status: "pending",
      document_path: doc.path,
      document_name: doc.name,
      document_mime: doc.mime,
      notes: "Uploaded by the candidate on their self-service link - check it.",
      created_by: "candidate",
    });
    if (error) return NextResponse.json({ error: "Couldn't save the document." }, { status: 500 });
    await logActivity(supabase, candidate.id, "candidate_document_uploaded", who, { note: `${CHECK_KINDS[kind]}: ${doc.name}` });
    await notify({ agencyId: candidate.agency_id, userId: candidate.recruiter_id, kind: "candidate_document", title: `${who} uploaded a document`, body: `${CHECK_KINDS[kind]} - check it on their compliance panel.`, href: `/dashboard/candidates/${candidate.id}` });
    return NextResponse.json({ ok: true, document: { kind: CHECK_KINDS[kind], name: doc.name, status: "Received" } }, { status: 201 });
  }

  const { update, changed, error: invalid } = cleanPortalUpdate(await request.json().catch(() => ({})), candidate);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!changed.length) return NextResponse.json({ ok: true, changed: [] });
  const { error } = await supabase
    .from("candidates")
    .update({ ...update, last_activity_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("agency_id", candidate.agency_id);
  if (error) return NextResponse.json({ error: "Couldn't save your details." }, { status: 500 });
  await supabase.from("candidate_portal_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);
  await logActivity(supabase, candidate.id, "candidate_self_updated", who, { note: `Updated: ${changed.join(", ")}` });
  await notify({ agencyId: candidate.agency_id, userId: candidate.recruiter_id, kind: "candidate_updated", title: `${who} updated their details`, body: changed.join(", "), href: `/dashboard/candidates/${candidate.id}` });
  after(() => emitWebhook(candidate.agency_id, "candidate.self_updated", { candidateId: candidate.id, changed }));
  return NextResponse.json({ ok: true, changed });
}
