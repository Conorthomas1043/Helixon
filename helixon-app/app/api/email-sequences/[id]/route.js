import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { cleanSequenceSteps, toSequence } from "@/lib/sequences";
import { agencyDb } from "@/lib/agency-db";

// PATCH { name?, steps?, active? } / DELETE one sequence. Pausing
// (active: false) holds every enrolment where it is; deleting removes the
// enrolments too (emails already sent stay on candidates' threads).

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const body = await request.json().catch(() => ({}));
  const update = {};
  if (body.name !== undefined) {
    update.name = cleanLine(body.name, 120);
    if (!update.name) return NextResponse.json({ error: "Name the sequence." }, { status: 400 });
  }
  if (body.steps !== undefined) {
    const steps = cleanSequenceSteps(body.steps);
    if (steps.error) return NextResponse.json({ error: steps.error }, { status: 400 });
    update.steps = steps.steps;
  }
  if (body.active !== undefined) update.active = body.active === true;
  if (!id || Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("email_sequences")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to save the sequence." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sequence: toSequence(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await (await agencyDb()).from("email_sequences").delete().eq("id", id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete the sequence." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
