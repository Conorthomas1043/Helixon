import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const { stage } = await request.json();
  if (!STAGE_LABELS[stage]) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("candidates")
    .select("stage")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("candidates")
    .update({ stage })
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }

  await logActivity(supabase, id, "stage_changed", recruiterDisplayName(profile) || userId, {
    from: before.stage,
    to: stage,
  });

  return NextResponse.json(data);
}
