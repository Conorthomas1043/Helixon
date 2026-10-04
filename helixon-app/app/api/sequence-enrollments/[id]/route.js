import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanUuid } from "@/lib/sanitize";
import { agencyDb } from "@/lib/agency-db";

// DELETE - take a candidate off a sequence (no more emails).
export const DELETE = customerRoute(async (request, { params }, auth) => {
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await (await agencyDb())
    .from("sequence_enrollments")
    .update({ status: "stopped", stopped_reason: "Stopped by hand", next_send_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .eq("status", "active")
    .select("candidate_id, email_sequences(name)");
  if (error) return NextResponse.json({ error: "Failed to stop it." }, { status: 500 });
  if (data?.length) {
    await logActivity(supabase, data[0].candidate_id, "sequence_stopped", recruiterDisplayName(auth.profile) || auth.userId, {
      note: data[0].email_sequences?.name,
    });
  }
  return NextResponse.json({ ok: true });
});
