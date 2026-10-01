import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { cleanClientFields, loadClient, logClientActivity, toClient, toContact } from "@/lib/clients";

// One client (lib/clients.js).
//
// GET     the client, its contacts, jobs, placements, invoices and timeline
// PATCH   edit details and terms (a rename updates its jobs' client name)
// DELETE  only when no jobs are attached - otherwise mark it inactive

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: contacts }, { data: jobs }, { data: activity }, { data: invoices }] = await Promise.all([
    supabase.from("client_contacts").select("*").eq("client_id", client.id).eq("agency_id", auth.agencyId).order("is_primary", { ascending: false }).order("name"),
    supabase
      .from("jobs")
      .select("id, title, status, location, salary_range, created_at, contact_id, candidates(id, full_name, name, stage, match_score, placement_fee, last_activity_at)")
      .eq("agency_id", auth.agencyId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false }),
    supabase.from("client_activity").select("id, type, actor, meta, created_at").eq("client_id", client.id).eq("agency_id", auth.agencyId).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("invoices")
      .select("id, number, status, total, currency, issued_on, due_on, paid_on")
      .eq("client_id", client.id)
      .eq("agency_id", auth.agencyId)
      .order("issued_on", { ascending: false })
      .limit(200),
  ]);

  const placements = [];
  const jobRows = (jobs ?? []).map((j) => {
    const cands = j.candidates ?? [];
    for (const c of cands) {
      if (c.stage === "Placed") {
        placements.push({ candidateId: c.id, candidateName: c.full_name || c.name || "Candidate", jobId: j.id, jobTitle: j.title, fee: c.placement_fee == null ? null : Number(c.placement_fee), at: c.last_activity_at });
      }
    }
    return {
      id: j.id,
      title: j.title,
      status: j.status,
      location: j.location,
      salaryRange: j.salary_range,
      createdAt: j.created_at,
      contactId: j.contact_id,
      candidates: cands.length,
      inProcess: cands.filter((c) => ["Shortlisted", "Interview", "Offer"].includes(c.stage)).length,
      placed: cands.filter((c) => c.stage === "Placed").length,
    };
  });

  const owner = await resolveRecruiterNames(supabase, [client.owner_id]);
  return NextResponse.json({
    client: { ...toClient(client), ownerName: owner.get(client.owner_id) ?? null },
    contacts: (contacts ?? []).map(toContact),
    jobs: jobRows,
    placements: placements.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? ""))),
    invoices: invoices ?? [],
    activity: (activity ?? []).map((a) => ({ id: a.id, type: a.type, actor: a.actor, meta: a.meta, createdAt: a.created_at })),
  });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const fields = cleanClientFields(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabase
    .from("clients")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", client.id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have a client with that name." }, { status: 409 });
    return NextResponse.json({ error: "Failed to update client." }, { status: 500 });
  }
  if (fields.name && fields.name !== client.name) {
    await supabase.from("jobs").update({ client: fields.name }).eq("client_id", client.id).eq("agency_id", auth.agencyId);
  }
  await logClientActivity(auth.agencyId, client.id, "client_updated", recruiterDisplayName(auth.profile) || auth.userId, {
    fields: Object.keys(fields),
  });
  return NextResponse.json({ client: toClient(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("agency_id", auth.agencyId);
  if (count) {
    return NextResponse.json({ error: "This client has jobs, so it can't be deleted. Mark it inactive instead." }, { status: 409 });
  }
  const { error } = await supabase.from("clients").delete().eq("id", client.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete client." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
