import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";

// PATCH { label, dueAt } to set a new next action.
// PATCH { completed: true } to complete the existing one.
export async function PATCH(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const body = await request.json();

  if (body.completed) {
    const { data: candidate } = await supabase
      .from("candidates")
      .select("next_action")
      .eq("id", params.id)
      .single();
    const label = candidate?.next_action?.label;

    const { error } = await supabase.from("candidates").update({ next_action: null }).eq("id", params.id);
    if (error) return Response.json({ error: "Failed to complete next action" }, { status: 500 });

    await logActivity(supabase, params.id, "next_action_completed", recruiter.name, { label });
    return Response.json({ nextAction: null });
  }

  if (!body.label?.trim()) return Response.json({ error: "label required" }, { status: 400 });

  const nextAction = { label: body.label.trim(), dueAt: body.dueAt ?? null, completed: false };
  const { error } = await supabase.from("candidates").update({ next_action: nextAction }).eq("id", params.id);
  if (error) return Response.json({ error: "Failed to set next action" }, { status: 500 });

  await logActivity(supabase, params.id, "next_action_set", recruiter.name, { label: nextAction.label });
  return Response.json({ nextAction });
}
