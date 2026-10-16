import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/auth/customer-auth";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/agency/workspace-admin";
import { resolveRecruiterNames } from "@/lib/agency/recruiter-directory";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { generateApiKey } from "@/lib/auth/api-keys";
import { logAudit } from "@/lib/agency/audit";
import { testFeatureRefusal } from "@/lib/agency/test-account";
import { fields, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const KeyInput = fields({ name: text(240) });

// The agency's API keys (lib/auth/api-keys.js). Owner and admins only.
// GET                 the keys (never the keys themselves - only prefixes)
// POST { name }       make one; the key is in this response and nowhere else
// DELETE ?id=         revoke one

const MAX_KEYS = 20;

async function guard() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (!(await canManageWorkspace(auth))) return { res: NextResponse.json({ error: NOT_ADMIN }, { status: 403 }) };
  return { auth };
}

export async function GET() {
  const { auth, res } = await guard();
  if (res) return res;
  const { data, error } = await supabase.from("api_keys").select("id, name, prefix, created_by, last_used_at, revoked_at, created_at").eq("agency_id", auth.agencyId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load keys." }, { status: 500 });
  const names = await resolveRecruiterNames(supabase, (data ?? []).map((k) => k.created_by));
  return NextResponse.json({
    keys: (data ?? []).map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdBy: names.get(k.created_by) ?? null, lastUsedAt: k.last_used_at, revokedAt: k.revoked_at, createdAt: k.created_at })),
  });
}

export async function POST(request) {
  const { auth, res } = await guard();
  if (res) return res;
  const notHere = await testFeatureRefusal(auth.agencyId);
  if (notHere) return NextResponse.json({ error: notHere.error }, { status: notHere.status });
  const parsedBody = await parseBody(request, KeyInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  const name = cleanLine(body.name, 80);
  if (!name) return NextResponse.json({ error: "Give the key a name, like 'Zapier' or 'LinkedIn extension'." }, { status: 400 });
  const { count } = await supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("agency_id", auth.agencyId).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return NextResponse.json({ error: `Up to ${MAX_KEYS} keys - revoke one you don't use.` }, { status: 400 });
  const k = generateApiKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ agency_id: auth.agencyId, name, prefix: k.prefix, key_hash: k.hash, created_by: auth.userId })
    .select("id, name, prefix, created_at")
    .single();
  if (error) return NextResponse.json({ error: "Failed to make the key." }, { status: 500 });
  await logAudit({ auth, request, action: "api_key.created", targetType: "api_key", targetId: data.id, summary: `Created API key "${data.name}" (${data.prefix}…)` });
  return NextResponse.json({ key: k.key, record: { id: data.id, name: data.name, prefix: data.prefix, createdAt: data.created_at } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request) {
  const { auth, res } = await guard();
  if (res) return res;
  const id = cleanUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Which key?" }, { status: 400 });
  await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("agency_id", auth.agencyId).is("revoked_at", null);
  await logAudit({ auth, request, action: "api_key.revoked", targetType: "api_key", targetId: id, summary: "Revoked an API key" });
  return NextResponse.json({ ok: true });
}
