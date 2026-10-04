import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { cleanContactFields, loadClient, logClientActivity, toContact } from "@/lib/clients";
import { agencyDb } from "@/lib/agency-db";

// A client's contacts (lib/clients.js).
//
// POST { name, jobTitle?, email?, phone?, notes?, isPrimary? }  add one
// PATCH { contactId, ...fields }                                 edit one
// DELETE ?contactId=                                             remove one
//
// One primary contact per client: making someone primary clears the rest.
// A contact's email is copied onto the jobs they're the contact for
// (jobs.client_email), which the client emails and feedback requests use.

async function context(params) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { auth, client, actor: recruiterDisplayName(auth.profile) || auth.userId };
}

async function clearOtherPrimaries(agencyId, clientId, keepId) {
  await (await agencyDb()).from("client_contacts").update({ is_primary: false }).eq("client_id", clientId).eq("agency_id", agencyId).neq("id", keepId);
}

export async function POST(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const body = await request.json().catch(() => ({}));
  const fields = cleanContactFields(body, { requireName: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const { count } = await (await agencyDb()).from("client_contacts").select("id", { count: "exact", head: true }).eq("client_id", ctx.client.id);
  const { data, error } = await (await agencyDb())
    .from("client_contacts")
    .insert({ ...fields, is_primary: fields.is_primary ?? !count, agency_id: ctx.auth.agencyId, client_id: ctx.client.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to add contact." }, { status: 500 });
  if (data.is_primary) await clearOtherPrimaries(ctx.auth.agencyId, ctx.client.id, data.id);
  await logClientActivity(ctx.auth.agencyId, ctx.client.id, "contact_added", ctx.actor, { note: data.name });
  return NextResponse.json({ contact: toContact(data) }, { status: 201 });
}

export async function PATCH(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const body = await request.json().catch(() => ({}));
  const contactId = cleanUuid(body.contactId);
  if (!contactId) return NextResponse.json({ error: "Which contact?" }, { status: 400 });
  const fields = cleanContactFields(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await (await agencyDb())
    .from("client_contacts")
    .update(fields)
    .eq("id", contactId)
    .eq("client_id", ctx.client.id)
    .eq("agency_id", ctx.auth.agencyId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update contact." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.is_primary && fields.is_primary) await clearOtherPrimaries(ctx.auth.agencyId, ctx.client.id, data.id);
  if (fields.email !== undefined) {
    await (await agencyDb()).from("jobs").update({ client_email: data.email }).eq("contact_id", data.id).eq("agency_id", ctx.auth.agencyId);
  }
  return NextResponse.json({ contact: toContact(data) });
}

export async function DELETE(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const contactId = cleanUuid(new URL(request.url).searchParams.get("contactId"));
  if (!contactId) return NextResponse.json({ error: "Which contact?" }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("client_contacts")
    .delete()
    .eq("id", contactId)
    .eq("client_id", ctx.client.id)
    .eq("agency_id", ctx.auth.agencyId)
    .select("name");
  if (error) return NextResponse.json({ error: "Failed to remove contact." }, { status: 500 });
  if (data?.length) await logClientActivity(ctx.auth.agencyId, ctx.client.id, "contact_removed", ctx.actor, { note: data[0].name });
  return NextResponse.json({ ok: true });
}
