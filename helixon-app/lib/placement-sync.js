// Keeping the candidate in step with their placement: the pipeline stage a
// placement status implies (lib/placements.js stageForStatus), and the
// placement fee/cost on the candidate row that Analytics' financials read.

import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidate-activity";
import { stageForStatus } from "@/lib/placements";
import { FUNNEL_ORDER } from "@/lib/stage-labels";

export async function syncCandidate(placement, actor) {
  if (!placement.candidate_id) return;
  const { data: c } = await supabase.from("candidates").select("id, stage").eq("id", placement.candidate_id).maybeSingle();
  if (!c) return;
  const update = {};
  if (placement.kind === "permanent" && placement.fee_amount != null) update.placement_fee = placement.fee_amount;
  const target = stageForStatus(placement.status);
  // Only ever forward through the funnel.
  if (target && c.stage !== "Rejected" && FUNNEL_ORDER.indexOf(target) > FUNNEL_ORDER.indexOf(c.stage)) {
    update.stage = target;
  }
  if (!Object.keys(update).length) return;
  await supabase.from("candidates").update(update).eq("id", c.id);
  if (update.stage) await logActivity(supabase, c.id, "stage_changed", actor, { from: c.stage, to: update.stage });
}
