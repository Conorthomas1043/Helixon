import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanUuid } from "@/lib/sanitize";
import { stepDueAt, stopReason } from "@/lib/sequences";
import { agencyDb } from "@/lib/agency-db";

// POST { candidateIds } - start these candidates on the sequence. People
// already on it, without an email address, or rejected/placed are skipped.
// The first email goes out on the next sequence run after its delay
// (app/api/cron/sequences).

export const POST = customerRoute(async (request, { params }, auth, body) => {
  const id = cleanUuid((await params).id);
  const { data: sequence } = id
    ? await (await agencyDb()).from("email_sequences").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle()
    : { data: null };
  if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sequence.active) return NextResponse.json({ error: "This sequence is paused." }, { status: 409 });

  const ids = [...new Set((Array.isArray(body.candidateIds) ? body.candidateIds : []).map(cleanUuid).filter(Boolean))].slice(0, 200);
  if (!ids.length) return NextResponse.json({ error: "Choose who to add." }, { status: 400 });

  const [{ data: candidates }, { data: existing }] = await Promise.all([
    (await agencyDb()).from("candidates").select("id, email, stage").eq("agency_id", auth.agencyId).in("id", ids),
    (await agencyDb()).from("sequence_enrollments").select("candidate_id").eq("sequence_id", sequence.id).eq("status", "active").in("candidate_id", ids),
  ]);
  const already = new Set((existing ?? []).map((e) => e.candidate_id));
  const skipped = [];
  const rows = [];
  const now = new Date();
  for (const c of candidates ?? []) {
    const reason = already.has(c.id) ? "Already on it" : stopReason(c);
    if (reason) {
      skipped.push({ candidateId: c.id, reason });
      continue;
    }
    rows.push({
      agency_id: auth.agencyId,
      sequence_id: sequence.id,
      candidate_id: c.id,
      next_step: 0,
      next_send_at: stepDueAt(sequence.steps, 0, now),
      enrolled_by: auth.userId,
    });
  }
  if (rows.length) {
    const { error } = await (await agencyDb()).from("sequence_enrollments").insert(rows);
    if (error) return NextResponse.json({ error: "Failed to add them to the sequence." }, { status: 500 });
    const actor = recruiterDisplayName(auth.profile) || auth.userId;
    await Promise.all(rows.map((r) => logActivity(supabase, r.candidate_id, "sequence_enrolled", actor, { note: sequence.name })));
  }
  return NextResponse.json({ enrolled: rows.length, skipped });
}, { body: JsonObject, optionalBody: true, requireSubscription: true });
