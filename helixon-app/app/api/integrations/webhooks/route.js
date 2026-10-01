import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { WEBHOOK_EVENTS, checkWebhookUrl, deliver, webhookSecret } from "@/lib/webhooks";

// The agency's webhook endpoints (lib/webhooks.js). Owner and admins only.
// GET                                   endpoints, with their signing secrets
// POST { url, events[], description }   add one
// PATCH { id, active?, events? }        pause/resume or change events
// PATCH { id, test: true }              send a test delivery now
// DELETE ?id=                           remove one

const MAX_ENDPOINTS = 10;

async function guard() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (!(await canManageWorkspace(auth))) return { res: NextResponse.json({ error: NOT_ADMIN }, { status: 403 }) };
  return { auth };
}

const cleanEvents = (list) => [...new Set((Array.isArray(list) ? list : []).filter((e) => WEBHOOK_EVENTS[e]))];

function toEndpoint(e) {
  return {
    id: e.id,
    url: e.url,
    description: e.description,
    events: e.events ?? [],
    secret: e.secret,
    active: e.active,
    lastStatus: e.last_status,
    lastError: e.last_error,
    lastDeliveryAt: e.last_delivery_at,
    failureCount: e.failure_count,
    createdAt: e.created_at,
  };
}

export async function GET() {
  const { auth, res } = await guard();
  if (res) return res;
  const { data, error } = await supabase.from("webhook_endpoints").select("*").eq("agency_id", auth.agencyId).order("created_at");
  if (error) return NextResponse.json({ error: "Failed to load webhooks." }, { status: 500 });
  return NextResponse.json({ endpoints: (data ?? []).map(toEndpoint), events: WEBHOOK_EVENTS }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const { auth, res } = await guard();
  if (res) return res;
  const body = await request.json().catch(() => ({}));
  const checked = checkWebhookUrl(body.url);
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { count } = await supabase.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("agency_id", auth.agencyId);
  if ((count ?? 0) >= MAX_ENDPOINTS) return NextResponse.json({ error: `Up to ${MAX_ENDPOINTS} webhooks.` }, { status: 400 });
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({ agency_id: auth.agencyId, url: checked.url, description: cleanLine(body.description, 120) || null, events: cleanEvents(body.events), secret: webhookSecret(), created_by: auth.userId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to add the webhook." }, { status: 500 });
  return NextResponse.json({ endpoint: toEndpoint(data) }, { status: 201 });
}

export async function PATCH(request) {
  const { auth, res } = await guard();
  if (res) return res;
  const body = await request.json().catch(() => ({}));
  const id = cleanUuid(body.id);
  const { data: endpoint } = id ? await supabase.from("webhook_endpoints").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle() : { data: null };
  if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.test === true) {
    const result = await deliver(endpoint, "candidate.created", { test: true, message: "This is a test delivery from Helixon." });
    await supabase
      .from("webhook_endpoints")
      .update({ last_status: result.status ?? null, last_error: result.error ?? null, last_delivery_at: new Date().toISOString() })
      .eq("id", endpoint.id);
    return NextResponse.json({ ok: !result.error, status: result.status ?? null, error: result.error ?? null });
  }

  const update = {};
  if (typeof body.active === "boolean") {
    update.active = body.active;
    if (body.active) update.failure_count = 0;
  }
  if (body.events !== undefined) update.events = cleanEvents(body.events);
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await supabase.from("webhook_endpoints").update(update).eq("id", endpoint.id).select("*").single();
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  return NextResponse.json({ endpoint: toEndpoint(data) });
}

export async function DELETE(request) {
  const { auth, res } = await guard();
  if (res) return res;
  const id = cleanUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Which webhook?" }, { status: 400 });
  await supabase.from("webhook_endpoints").delete().eq("id", id).eq("agency_id", auth.agencyId);
  return NextResponse.json({ ok: true });
}
