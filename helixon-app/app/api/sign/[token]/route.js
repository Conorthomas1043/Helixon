import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { emitWebhook } from "@/lib/webhooks";
import { logActivity } from "@/lib/candidates/activity";
import { logClientActivity } from "@/lib/clients";
import { notify } from "@/lib/notifications";
import { SIGNATURE_KINDS, TOKEN_RE, cleanSignature, documentHash } from "@/lib/signatures";

// Public: the signing page (app/sign/[token]). The token is the only
// credential, so this answers with only the document and who it's for,
// and accepts one signature (or a decline).

async function load(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data } = await supabase.from("signature_requests").select("*, agencies(name)").eq("token", token).maybeSingle();
  return data;
}

const expired = (row) => row.expires_at && new Date(row.expires_at).getTime() < Date.now();

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`sign-get:${getClientIp(request)}`, 120))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (row.status === "sent" && !row.viewed_at) await supabase.from("signature_requests").update({ viewed_at: new Date().toISOString() }).eq("id", row.id);
  return NextResponse.json({
    agencyName: row.agencies?.name ?? null,
    kind: SIGNATURE_KINDS[row.kind],
    title: row.title,
    body: row.body,
    signerName: row.signer_name,
    status: row.status,
    expired: row.status === "sent" && expired(row),
    signedAt: row.signed_at,
    signedName: row.signed_name,
    documentHash: row.status === "signed" ? row.document_hash : null,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  const ip = getClientIp(request);
  if (!(await rateLimit(`sign-post:${ip}`, 20))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (row.status !== "sent") return NextResponse.json({ error: row.status === "signed" ? "This has already been signed." : "This document is no longer available." }, { status: 409 });
  if (expired(row)) return NextResponse.json({ error: "This link has expired - please ask for a new one." }, { status: 410 });
  // The text must be what was sent - refuse if it's been changed since.
  if (documentHash(row.title, row.body) !== row.document_hash) return NextResponse.json({ error: "This document has changed - please ask for a new link." }, { status: 409 });

  const answer = cleanSignature(await request.json().catch(() => ({})));
  if (answer.error) return NextResponse.json({ error: answer.error }, { status: 400 });

  const now = new Date().toISOString();
  const update = answer.decline
    ? { status: "declined", declined_reason: answer.reason }
    : {
        status: "signed",
        signed_at: now,
        signed_name: answer.name,
        signed_ip: String(ip || "").slice(0, 100) || null,
        signed_user_agent: (request.headers.get("user-agent") || "").slice(0, 500) || null,
      };
  const { data, error } = await supabase.from("signature_requests").update(update).eq("id", row.id).eq("status", "sent").select("id");
  if (error) return NextResponse.json({ error: "Couldn't save that - please try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "This has already been answered." }, { status: 409 });

  const what = `${SIGNATURE_KINDS[row.kind]} "${row.title}"`;
  const note = answer.decline ? `${row.signer_name} declined to sign ${what}${answer.reason ? `: ${answer.reason}` : ""}` : `${answer.name} signed ${what}`;
  if (row.candidate_id) await logActivity(supabase, row.candidate_id, answer.decline ? "signature_declined" : "signature_signed", row.signer_name, { note });
  if (row.client_id) {
    await logClientActivity(row.agency_id, row.client_id, answer.decline ? "signature_declined" : "signature_signed", row.signer_name, { note });
    if (!answer.decline && row.kind === "terms") {
      await supabase.from("clients").update({ terms_signed_at: now, terms_signature_id: row.id }).eq("id", row.client_id).eq("agency_id", row.agency_id);
    }
  }
  await notify({
    agencyId: row.agency_id,
    userId: row.created_by,
    kind: answer.decline ? "signature_declined" : "signature_signed",
    title: answer.decline ? `${row.signer_name} declined to sign` : `${answer.name} signed ${row.title}`,
    body: answer.decline ? answer.reason : null,
    href: row.candidate_id ? `/dashboard/candidates/${row.candidate_id}` : row.client_id ? `/dashboard/clients/${row.client_id}` : null,
  });
  after(() =>
    emitWebhook(row.agency_id, answer.decline ? "signature.declined" : "signature.signed", {
      requestId: row.id,
      kind: row.kind,
      title: row.title,
      clientId: row.client_id,
      candidateId: row.candidate_id,
      placementId: row.placement_id,
      signedAt: answer.decline ? null : now,
    })
  );
  return NextResponse.json({ ok: true, status: update.status, signedAt: update.signed_at ?? null });
}
