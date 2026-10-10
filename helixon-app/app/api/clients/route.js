import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { ClientInput } from "@/lib/api/schemas";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { cleanClientFields, logClientActivity, toClient } from "@/lib/clients";
import { getAccess, withoutMoney } from "@/lib/permissions";
import { fetchAll } from "@/lib/fetch-all";
import { agencyDb } from "@/lib/agency-db";

// The agency's clients (lib/clients.js).
//
// GET                 every client with its open jobs, contacts, placements
//                     and fees billed
// POST { name, ... }  create one

export const GET = customerRoute(async (_request, _context, auth) => {
  // A page at a time: one select stops at 1,000 rows, which undercounted
  // contacts, jobs and fees for a larger agency.
  const db = await agencyDb();
  const [{ data: clients, error }, { data: contacts }, { data: jobs }] = await Promise.all([
    fetchAll((from, to) => db.from("clients").select("*").eq("agency_id", auth.agencyId).order("name").order("id").range(from, to), { cap: 5000 }),
    fetchAll((from, to) => db.from("client_contacts").select("id, client_id").eq("agency_id", auth.agencyId).order("id").range(from, to)),
    fetchAll((from, to) =>
      db
        .from("jobs")
        .select("id, client_id, status, candidates(stage, placement_fee)")
        .eq("agency_id", auth.agencyId)
        .not("client_id", "is", null)
        .order("id")
        .range(from, to),
    ),
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
});

export const POST = customerRoute(async (request, _context, auth, body) => {
  const access = await getAccess(auth);
  const cleaned = cleanClientFields(body, { requireName: true });
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const fields = withoutMoney(cleaned, access, ["fee_percent"]);

  const { data, error } = await (await agencyDb())
    .from("clients")
    .insert({ ...fields, agency_id: auth.agencyId, owner_id: fields.owner_id ?? auth.userId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have a client with that name." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create client." }, { status: 500 });
  }
  await logClientActivity(auth.agencyId, data.id, "client_created", recruiterDisplayName(auth.profile) || auth.userId);
  const shaped = toClient(data);
  return NextResponse.json({ client: access.canSeeFinancials ? shaped : { ...shaped, feePercent: null } }, { status: 201 });
}, { body: ClientInput, optionalBody: true });
