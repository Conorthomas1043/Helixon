import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanLine } from "@/lib/sanitize";
import { cleanSequenceSteps, toSequence } from "@/lib/sequences";
import { agencyDb } from "@/lib/agency-db";

// Email sequences (lib/sequences.js).
//
// GET                         each sequence with active/completed/stopped counts
// POST { name, steps }        create one

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data, error }, { data: enrollments }] = await Promise.all([
    (await agencyDb()).from("email_sequences").select("*").eq("agency_id", auth.agencyId).order("name"),
    (await agencyDb()).from("sequence_enrollments").select("sequence_id, status, stopped_reason").eq("agency_id", auth.agencyId).limit(20000),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load sequences." }, { status: 500 });
  const stats = new Map();
  for (const e of enrollments ?? []) {
    if (!stats.has(e.sequence_id)) stats.set(e.sequence_id, { active: 0, completed: 0, stopped: 0, replied: 0 });
    const s = stats.get(e.sequence_id);
    s[e.status] += 1;
    if (e.stopped_reason === "Replied") s.replied += 1;
  }
  return NextResponse.json({ sequences: (data ?? []).map((r) => toSequence(r, stats.get(r.id) ?? { active: 0, completed: 0, stopped: 0, replied: 0 })) });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const name = cleanLine(body.name, 120);
  if (!name) return NextResponse.json({ error: "Name the sequence." }, { status: 400 });
  const steps = cleanSequenceSteps(body.steps);
  if (steps.error) return NextResponse.json({ error: steps.error }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("email_sequences")
    .insert({ agency_id: auth.agencyId, name, steps: steps.steps, created_by: auth.userId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the sequence." }, { status: 500 });
  return NextResponse.json({ sequence: toSequence(data) }, { status: 201 });
}
