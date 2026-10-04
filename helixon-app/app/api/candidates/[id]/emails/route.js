import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// GET - the emails sent to and received from this candidate through
// Helixon (email_messages), oldest first, and any sequences they're in.

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: candidate } = await (await agencyDb()).from("candidates").select("id").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: messages }, { data: enrollments }] = await Promise.all([
    (await agencyDb())
      .from("email_messages")
      .select("id, direction, from_email, to_email, subject, body_text, created_at, enrollment_id")
      .eq("candidate_id", id)
      .eq("agency_id", auth.agencyId)
      .order("created_at", { ascending: true })
      .limit(200),
    (await agencyDb())
      .from("sequence_enrollments")
      .select("id, status, next_step, next_send_at, stopped_reason, created_at, email_sequences(id, name, steps)")
      .eq("candidate_id", id)
      .eq("agency_id", auth.agencyId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.from_email,
      to: m.to_email,
      subject: m.subject,
      body: m.body_text,
      at: m.created_at,
      viaSequence: Boolean(m.enrollment_id),
    })),
    enrollments: (enrollments ?? []).map((e) => ({
      id: e.id,
      status: e.status,
      sequenceId: e.email_sequences?.id ?? null,
      sequenceName: e.email_sequences?.name ?? "Sequence",
      steps: Array.isArray(e.email_sequences?.steps) ? e.email_sequences.steps.length : 0,
      nextStep: e.next_step,
      nextSendAt: e.next_send_at,
      stoppedReason: e.stopped_reason,
      enrolledAt: e.created_at,
    })),
  });
}
