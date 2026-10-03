import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { logClientActivity } from "@/lib/clients";
import { OPPORTUNITY_STAGES, cleanOpportunity, toOpportunity } from "@/lib/opportunities";

// PATCH { title?, stage?, value?, probability?, expectedClose?, ownerId?,
//         notes?, lostReason?, jobId? }   update a deal
// DELETE                                 remove it

async function load(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("client_opportunities").select("*").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const current = await load(auth.agencyId, id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) ?? {};
  const update = cleanOpportunity(body);
  if (update.error) return NextResponse.json({ error: update.error }, { status: 400 });

  // A won deal can be linked to the job it turned into.
  if (body.jobId !== undefined) {
    const jobId = cleanUuid(body.jobId);
    if (jobId) {
      const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("agency_id", auth.agencyId).maybeSingle();
      if (!job) return NextResponse.json({ error: "Unknown job." }, { status: 400 });
    }
    update.job_id = jobId;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const closing = update.stage && update.stage !== current.stage;
  if (closing) update.closed_at = update.stage === "won" || update.stage === "lost" ? new Date().toISOString() : null;
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("client_opportunities")
    .update(update)
    .eq("id", current.id)
    .eq("agency_id", auth.agencyId)
    .select("*, clients(name)")
    .single();
  if (error) return NextResponse.json({ error: "Failed to update the deal." }, { status: 500 });

  if (closing) {
    await logClientActivity(auth.agencyId, current.client_id, "opportunity_stage", recruiterDisplayName(auth.profile) || auth.userId, {
      note: `${data.title}: ${OPPORTUNITY_STAGES[current.stage]} → ${OPPORTUNITY_STAGES[data.stage]}`,
    });
  }
  return NextResponse.json({ opportunity: toOpportunity(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const current = await load(auth.agencyId, id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from("client_opportunities").delete().eq("id", current.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete the deal." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
