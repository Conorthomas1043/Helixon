import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { cleanClientFields, logClientActivity, toClient } from "@/lib/clients";
import { getAccess } from "@/lib/permissions";

// The agency's clients (lib/clients.js).
//
// GET                 every client with its open jobs, contacts, placements
//                     and fees billed
// POST { name, ... }  create one

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [{ data: clients, error }, { data: contacts }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("*").eq("agency_id", auth.agencyId).order("name").limit(2000),
    supabase.from("client_contacts").select("client_id").eq("agency_id", auth.agencyId).limit(10000),
    supabase
      .from("jobs")
      .select("id, client_id, status, candidates(stage, placement_fee)")
      .eq("agency_id", auth.agencyId)
      .not("client_id", "is", null)
      .limit(5000),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load clients." }, { status: 500 });

  const stats = new Map();
  const stat = (id) => {
    if (!stats.has(id)) stats.set(id, { contacts: 0, openJobs: 0, jobs: 0, placements: 0, fees: 0 });
    return stats.get(id);
  };
  for (const c of contacts ?? []) stat(c.client_id).contacts += 1;
  for (const j of jobs ?? []) {
    const s = stat(j.client_id);
    s.jobs += 1;
    if (j.status === "open") s.openJobs += 1;
    for (const c of j.candidates ?? []) {
      if (c.stage !== "Placed") continue;
      s.placements += 1;
      s.fees += Number(c.placement_fee) || 0;
    }
  }

  const owners = await resolveRecruiterNames(supabase, (clients ?? []).map((c) => c.owner_id));
  const { canSeeFinancials } = await getAccess(auth);
  return NextResponse.json({
    clients: (clients ?? []).map((c) => {
      const stat = stats.get(c.id) ?? { contacts: 0, openJobs: 0, jobs: 0, placements: 0, fees: 0 };
      return {
        ...toClient(c),
        ownerName: owners.get(c.owner_id) ?? null,
        ...stat,
        ...(canSeeFinancials ? {} : { fees: null, feePercent: null }),
      };
    }),
  });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const fields = cleanClientFields(body, { requireName: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...fields, agency_id: auth.agencyId, owner_id: fields.owner_id ?? auth.userId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have a client with that name." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create client." }, { status: 500 });
  }
  await logClientActivity(auth.agencyId, data.id, "client_created", recruiterDisplayName(auth.profile) || auth.userId);
  return NextResponse.json({ client: toClient(data) }, { status: 201 });
}
