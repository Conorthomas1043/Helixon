import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { loadClient, logClientActivity } from "@/lib/clients";
import { cleanOpportunity, toOpportunity } from "@/lib/opportunities";
import { agencyDb } from "@/lib/agency-db";

// Business-development deals (lib/opportunities.js).
//
// GET ?clientId=                       every deal (or one client's), newest first
// POST { clientId, title, stage?, value?, probability?, expectedClose?,
//        ownerId?, contactId?, notes? }  create one

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = cleanUuid(new URL(request.url).searchParams.get("clientId"));

  let q = (await agencyDb())
    .from("client_opportunities")
    .select("*, clients(name)")
    .eq("agency_id", auth.agencyId)
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) {
    // Before the migration is applied there's simply nothing to show.
    if (["42P01", "PGRST205", "PGRST200"].includes(error.code)) return NextResponse.json({ opportunities: [], unavailable: true });
    return NextResponse.json({ error: "Failed to load deals." }, { status: 500 });
  }
  return NextResponse.json({ opportunities: (data ?? []).map(toOpportunity) });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) ?? {};

  const client = await loadClient(auth.agencyId, body.clientId);
  if (!client) return NextResponse.json({ error: "Pick the client or prospect this deal is with." }, { status: 400 });
  const fields = cleanOpportunity(body, { requireTitle: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const contactId = cleanUuid(body.contactId);
  if (contactId) {
    const { data: contact } = await (await agencyDb()).from("client_contacts").select("id").eq("id", contactId).eq("client_id", client.id).maybeSingle();
    if (!contact) return NextResponse.json({ error: "That contact isn't at this client." }, { status: 400 });
  }

  const { data, error } = await (await agencyDb())
    .from("client_opportunities")
    .insert({
      ...fields,
      agency_id: auth.agencyId,
      client_id: client.id,
      contact_id: contactId,
      owner_id: fields.owner_id ?? auth.userId,
      created_by: auth.userId,
      closed_at: fields.stage === "won" || fields.stage === "lost" ? new Date().toISOString() : null,
    })
    .select("*, clients(name)")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the deal." }, { status: 500 });

  await logClientActivity(auth.agencyId, client.id, "opportunity_created", recruiterDisplayName(auth.profile) || auth.userId, { note: data.title });
  return NextResponse.json({ opportunity: toOpportunity(data) }, { status: 201 });
}
