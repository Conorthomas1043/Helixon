import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { fields, flag } from "@/lib/api/schemas";
import { cleanUuid } from "@/lib/sanitize";
import { siteUrl } from "@/lib/messaging/mailer";
import { documentHidden, toSignatureRequest } from "@/lib/clients/signatures";
import { candidateHidden, getAccess } from "@/lib/agency/permissions";
import { logAudit } from "@/lib/agency/audit";
import { agencyDb } from "@/lib/agency-db";

const VoidInput = fields({ void: flag });

// GET              one request, with the full text and audit trail
// PATCH { void }   withdraw one that hasn't been signed yet

// The request, or null when it isn't this agency's or is about a candidate
// "own candidates only" hides from this member.
async function load(auth, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await (await agencyDb()).from("signature_requests").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle();
  if (data?.candidate_id && (await candidateHidden(auth, data.candidate_id))) return null;
  return data;
}

export const GET = customerRoute(async (request, { params }, auth) => {
  const row = await load(auth, (await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hideText = documentHidden(row, await getAccess(auth), auth);
  return NextResponse.json({
    request: {
      ...toSignatureRequest(row, { includeLink: row.status === "sent" && !hideText, siteUrl: siteUrl() }),
      body: hideText ? null : row.body,
      bodyHidden: hideText,
      audit: row.status === "signed" ? { signedName: row.signed_name, signedAt: row.signed_at, ip: row.signed_ip, userAgent: row.signed_user_agent, documentHash: row.document_hash } : null,
    },
  });
});

export const PATCH = customerRoute(async (request, { params }, auth, input) => {
  const row = await load(auth, (await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = input;
  if (body.void !== true) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  if (row.status !== "sent") return NextResponse.json({ error: "Only a document that hasn't been signed can be withdrawn." }, { status: 409 });
  const { data, error } = await (await agencyDb()).from("signature_requests").update({ status: "void" }).eq("id", row.id).eq("status", "sent").select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Couldn't withdraw it." }, { status: 500 });
  await logAudit({ auth, request, action: "signature.withdrawn", targetType: "signature", targetId: data.id, summary: `Withdrew "${data.title}"` });
  return NextResponse.json({ request: toSignatureRequest(data) });
}, { body: VoidInput, optionalBody: true });
