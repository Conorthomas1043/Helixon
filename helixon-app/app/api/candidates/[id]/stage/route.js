import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";
import { STAGE_LABELS } from "@/lib/stage-labels";

export async function PATCH(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { stage } = await request.json();
  if (!STAGE_LABELS[stage]) {
    return Response.json({ error: "Invalid stage" }, { status: 400 });
  }

  const { data: before } = await supabase.from("candidates").select("stage").eq("id", params.id).single();

  const { data, error } = await supabase
    .from("candidates")
    .update({ stage })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: "Failed to update stage" }, { status: 500 });

  await logActivity(supabase, params.id, "stage_changed", recruiter.name, {
    from: before?.stage ?? null,
    to: stage,
  });

  return Response.json(data);
}
