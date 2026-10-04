import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { cleanUuid } from "@/lib/sanitize";
import { siteUrl } from "@/lib/mailer";
import { toSignatureRequest } from "@/lib/signatures";
import { logAudit } from "@/lib/agency-audit";
import { agencyDb } from "@/lib/agency-db";

// GET              one request, with the full text and audit trail
// PATCH { void }   withdraw one that hasn't been signed yet

async function load(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await (await agencyDb()).from("signature_requests").select("*").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

export const GET = customerRoute(async (request, { params }, auth) => {
  const row = await load(auth.agencyId, (await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    request: {
      ...toSignatureRequest(row, { includeLink: row.status === "sent", siteUrl: siteUrl() }),
      body: row.body,
      audit: row.status === "signed" ? { signedName: row.signed_name, signedAt: row.signed_at, ip: row.signed_ip, userAgent: row.signed_user_agent, documentHash: row.document_hash } : null,
    },
  });
});

export const PATCH = customerRoute(async (request, { params }, auth, input) => {
  const row = await load(auth.agencyId, (await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = input;
  if (body.void !== true) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  if (row.status !== "sent") return NextResponse.json({ error: "Only a document that hasn't been signed can be withdrawn." }, { status: 409 });
  const { data, error } = await (await agencyDb()).from("signature_requests").update({ status: "void" }).eq("id", row.id).eq("status", "sent").select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Couldn't withdraw it." }, { status: 500 });
  await logAudit({ auth, request, action: "signature.withdrawn", targetType: "signature", targetId: data.id, summary: `Withdrew "${data.title}"` });
  return NextResponse.json({ request: toSignatureRequest(data) });
}, { body: JsonObject, optionalBody: true });
