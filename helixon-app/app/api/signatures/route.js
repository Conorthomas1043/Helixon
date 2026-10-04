import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { agencyFromName, sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { logActivity } from "@/lib/candidate-activity";
import { logClientActivity } from "@/lib/clients";
import { SIGNATURE_KINDS, cleanSignatureRequest, documentHash, newToken, toSignatureRequest } from "@/lib/signatures";
import { agencyDb } from "@/lib/agency-db";

// Documents sent for e-signature (lib/signatures.js).
//
// GET ?clientId= | ?candidateId=    requests for one client or candidate
// POST { kind, title, body, signerName, signerEmail?, clientId?,
//        candidateId?, placementId?, send? }
//      create one; with send and an email, email the signing link

export const GET = customerRoute(async (request, _context, auth) => {
  const params = new URL(request.url).searchParams;
  const clientId = cleanUuid(params.get("clientId"));
  const candidateId = cleanUuid(params.get("candidateId"));
  if (!clientId && !candidateId) return NextResponse.json({ error: "Which client or candidate?" }, { status: 400 });

  let q = (await agencyDb()).from("signature_requests").select("*").eq("agency_id", auth.agencyId).order("created_at", { ascending: false }).limit(100);
  if (clientId) q = q.eq("client_id", clientId);
  if (candidateId) q = q.eq("candidate_id", candidateId);
  const { data, error } = await q;
  if (error) {
    if (["42P01", "PGRST205", "PGRST200"].includes(error.code)) return NextResponse.json({ requests: [], unavailable: true });
    return NextResponse.json({ error: "Failed to load documents." }, { status: 500 });
  }
  return NextResponse.json({ requests: (data ?? []).map((r) => toSignatureRequest(r, { includeLink: r.status === "sent", siteUrl: siteUrl() })) });
});

export const POST = customerRoute(async (request, _context, auth, input) => {
  const body = input;
  const fields = cleanSignatureRequest(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const clientId = cleanUuid(body.clientId);
  const candidateId = cleanUuid(body.candidateId);
  const placementId = cleanUuid(body.placementId);
  if (!clientId && !candidateId) return NextResponse.json({ error: "A document is for a client or a candidate." }, { status: 400 });
  const owned = async (table, id) => !id || Boolean((await supabase.from(table).select("id").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle()).data);
  if (!(await owned("clients", clientId)) || !(await owned("candidates", candidateId)) || !(await owned("placements", placementId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const send = body.send === true && fields.signerEmail;
  const { data, error } = await (await agencyDb())
    .from("signature_requests")
    .insert({
      agency_id: auth.agencyId,
      kind: fields.kind,
      title: fields.title,
      body: fields.body,
      document_hash: documentHash(fields.title, fields.body),
      client_id: clientId,
      candidate_id: candidateId,
      placement_id: placementId,
      signer_name: fields.signerName,
      signer_email: fields.signerEmail,
      token: newToken(),
      status: "sent",
      sent_at: send ? now.toISOString() : null,
      expires_at: new Date(now.getTime() + fields.expiresInDays * 86400000).toISOString(),
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return NextResponse.json({ error: "E-signatures need a database update first (migration 20261003010000)." }, { status: 503 });
    return NextResponse.json({ error: "Failed to save the document." }, { status: 500 });
  }

  const link = `${siteUrl()}/sign/${data.token}`;
  let emailError = null;
  if (send) {
    const agencyName = await agencyFromName(auth.agencyId, auth.profile);
    const recruiter = recruiterDisplayName(auth.profile);
    const res = await sendAgencyEmail({
      agencyId: auth.agencyId,
      profile: auth.profile,
      to: data.signer_email,
      subject: `${data.title} - please review and sign`,
      text: [
        `Hi ${data.signer_name.split(" ")[0]},`,
        "",
        `${agencyName} has sent you "${data.title}" to review and sign online. It takes a minute - no account needed:`,
        "",
        link,
        "",
        `The link works until ${new Date(data.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
        "",
        recruiter ? `${recruiter}\n${agencyName}` : agencyName,
      ].join("\n"),
    });
    emailError = res.error || null;
    if (emailError) await (await agencyDb()).from("signature_requests").update({ sent_at: null }).eq("id", data.id);
  }

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const note = `${SIGNATURE_KINDS[data.kind]} sent to ${data.signer_name} for signature${send && !emailError ? " (emailed)" : ""}`;
  if (candidateId) await logActivity(supabase, candidateId, "signature_requested", actor, { note });
  if (clientId) await logClientActivity(auth.agencyId, clientId, "signature_requested", actor, { note });

  return NextResponse.json({ request: toSignatureRequest(data, { includeLink: true, siteUrl: siteUrl() }), link, emailError }, { status: 201 });
}, { body: JsonObject, optionalBody: true });
