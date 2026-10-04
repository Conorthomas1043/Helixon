import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanUuid } from "@/lib/sanitize";
import { PLACEMENT_STATUSES, cleanPlacement, contractMargin, toPlacement } from "@/lib/placements";
import { splitsAreTeammates, syncCandidate } from "@/lib/placement-sync";
import { getAccess, redactPlacement } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// One placement: GET (with invoices and timesheets), PATCH, DELETE (only
// while nothing has been invoiced).

async function load(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await (await agencyDb()).from("placements").select("*").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await load(auth.agencyId, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: invoices }, { data: timesheets }] = await Promise.all([
    (await agencyDb()).from("invoices").select("id, number, status, total, currency, issued_on, due_on, paid_on").eq("placement_id", p.id).eq("agency_id", auth.agencyId).order("issued_on", { ascending: false }),
    (await agencyDb()).from("timesheets").select("*").eq("placement_id", p.id).eq("agency_id", auth.agencyId).order("week_starting", { ascending: false }),
  ]);
  const access = await getAccess(auth);
  return NextResponse.json({
    placement: redactPlacement({ ...toPlacement(p), margin: access.canSeeFinancials ? contractMargin(p.pay_rate, p.charge_rate) : null }, access),
    invoices: access.canSeeFinancials ? invoices ?? [] : [],
    timesheets: (timesheets ?? []).map((t) => ({
      id: t.id,
      weekStarting: t.week_starting,
      quantity: Number(t.quantity),
      status: t.status,
      approvedBy: t.approved_by,
      invoiceId: t.invoice_id,
      notes: t.notes,
    })),
  });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await load(auth.agencyId, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fields = cleanPlacement(await request.json().catch(() => ({})), p);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  if (fields.splits && !(await splitsAreTeammates(auth.agencyId, fields.splits))) {
    return NextResponse.json({ error: "Everyone in a split must be in your team." }, { status: 400 });
  }
  const { data, error } = await (await agencyDb())
    .from("placements")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", p.id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  if (fields.status && fields.status !== p.status && data.candidate_id) {
    await logActivity(supabase, data.candidate_id, "placement_recorded", actor, { note: PLACEMENT_STATUSES[fields.status] });
  }
  await syncCandidate(data, actor);
  after(() => emitWebhook(auth.agencyId, "placement.updated", { ...toPlacement(data), previousStatus: p.status }));
  return NextResponse.json({ placement: redactPlacement(toPlacement(data), await getAccess(auth)) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const p = await load(auth.agencyId, (await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { count } = await (await agencyDb()).from("invoices").select("id", { count: "exact", head: true }).eq("placement_id", p.id);
  if (count) return NextResponse.json({ error: "It has invoices, so it can't be deleted - void the invoices or mark it as fallen through." }, { status: 409 });
  const { error } = await (await agencyDb()).from("placements").delete().eq("id", p.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
