import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { logClientActivity } from "@/lib/clients";
import { cleanUuid } from "@/lib/sanitize";
import { PLACEMENT_STATUSES, cleanPlacement, toPlacement } from "@/lib/placements";
import { syncCandidate } from "@/lib/placement-sync";

// Offers and placements (lib/placements.js).
//
// GET ?candidateId=&status=&kind=   list, newest first, with their invoices
// POST { candidateId, kind, ...offer }   record an offer. The client's fee
//     terms are used unless given; the candidate moves to Offer / Placed to
//     match the status.

const INVOICE_COLS = "id, number, status, total, currency, issued_on, due_on, paid_on";

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  let query = supabase.from("placements").select(`*, invoices(${INVOICE_COLS})`).eq("agency_id", auth.agencyId).order("created_at", { ascending: false }).limit(2000);
  const candidateId = cleanUuid(params.get("candidateId"));
  if (candidateId) query = query.eq("candidate_id", candidateId);
  if (PLACEMENT_STATUSES[params.get("status")]) query = query.eq("status", params.get("status"));
  if (["permanent", "contract"].includes(params.get("kind"))) query = query.eq("kind", params.get("kind"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load placements." }, { status: 500 });
  const names = await resolveRecruiterNames(supabase, (data ?? []).map((p) => p.recruiter_id));
  return NextResponse.json({
    placements: (data ?? []).map((p) => ({ ...toPlacement(p), recruiterName: names.get(p.recruiter_id) ?? null, invoices: p.invoices ?? [] })),
  });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const candidateId = cleanUuid(body.candidateId);
  const { data: candidate } = candidateId
    ? await supabase
        .from("candidates")
        .select("id, full_name, name, recruiter_id, job_id, jobs(id, title, client, client_id, clients(name, fee_percent, rebate_days))")
        .eq("id", candidateId)
        .eq("agency_id", auth.agencyId)
        .maybeSingle()
    : { data: null };
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const terms = candidate.jobs?.clients || {};
  const withDefaults = {
    kind: "permanent",
    status: "offered",
    ...(terms.fee_percent != null && body.feePercent === undefined ? { feePercent: Number(terms.fee_percent) } : {}),
    ...(terms.rebate_days != null && body.rebateDays === undefined ? { rebateDays: terms.rebate_days } : {}),
    ...body,
  };
  const fields = cleanPlacement(withDefaults);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const { data, error } = await supabase
    .from("placements")
    .insert({
      ...fields,
      agency_id: auth.agencyId,
      candidate_id: candidate.id,
      job_id: candidate.job_id,
      client_id: candidate.jobs?.client_id ?? null,
      recruiter_id: candidate.recruiter_id || auth.userId,
      candidate_name: candidate.full_name || candidate.name || "Candidate",
      job_title: candidate.jobs?.title ?? null,
      client_name: candidate.jobs?.clients?.name || candidate.jobs?.client || null,
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the placement." }, { status: 500 });

  await logActivity(supabase, candidate.id, "placement_recorded", actor, { note: `${PLACEMENT_STATUSES[data.status]}${data.kind === "contract" ? " (contract)" : ""}` });
  if (data.client_id) await logClientActivity(auth.agencyId, data.client_id, "placement_made", actor, { note: `${data.candidate_name}: ${PLACEMENT_STATUSES[data.status]}` });
  await syncCandidate(data, actor);
  after(() => emitWebhook(auth.agencyId, "placement.created", toPlacement(data)));
  return NextResponse.json({ placement: { ...toPlacement(data), invoices: [] } }, { status: 201 });
}
