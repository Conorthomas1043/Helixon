import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { normaliseCustomisation } from "@/lib/custom-fields";

// PATCH { stage?, subStage? } - move a candidate to a core stage and/or one
// of the agency's sub-stages (lib/custom-fields.js). A sub-stage on its own
// also moves them to the stage it sits under; changing the stage without
// one clears the sub-stage.
export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  let { stage } = body;
  const wantsSubStage = body.subStage !== undefined;
  let subStage = null;
  if (wantsSubStage && body.subStage) {
    const { data: agency } = await supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle();
    subStage = normaliseCustomisation(agency?.settings).subStages.find((s) => s.id === body.subStage) ?? null;
    if (!subStage) return NextResponse.json({ error: "Unknown sub-stage" }, { status: 400 });
    if (stage && stage !== subStage.stage) return NextResponse.json({ error: "That sub-stage belongs to another stage" }, { status: 400 });
    stage = subStage.stage;
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
  if (!stage && wantsSubStage) stage = before.stage;
  if (!STAGE_LABELS[stage]) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const update = { stage };
  // A new stage drops the old sub-stage. Left alone otherwise, so the stage
  // still changes on a database without the sub_stage column yet.
  if (wantsSubStage || stage !== before.stage) update.sub_stage = subStage?.id ?? null;

  let { data, error } = await supabase.from("candidates").update(update).eq("id", id).eq("agency_id", agencyId).select().single();
  if (error?.code === "42703" && !subStage) {
    ({ data, error } = await supabase.from("candidates").update({ stage }).eq("id", id).eq("agency_id", agencyId).select().single());
  }

  if (error) {
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }

  const actor = recruiterDisplayName(profile) || userId;
  if (stage !== before.stage) {
    await logActivity(supabase, id, "stage_changed", actor, { from: before.stage, to: stage, ...(subStage ? { sub: subStage.label } : {}) });
  } else if (wantsSubStage) {
    await logActivity(supabase, id, "sub_stage_changed", actor, { note: subStage ? subStage.label : `Back to ${STAGE_LABELS[stage]}` });
  }

  return NextResponse.json(data);
}
