import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";

export async function PATCH(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { recruiterId } = await request.json();

  const { data: before } = await supabase
    .from("candidates")
    .select("recruiter:recruiters(name)")
    .eq("id", params.id)
    .single();

  const { data: after } = recruiterId
    ? await supabase.from("recruiters").select("name").eq("id", recruiterId).single()
    : { data: null };

  const { data, error } = await supabase
    .from("candidates")
    .update({ recruiter_id: recruiterId ?? null })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: "Failed to reassign" }, { status: 500 });

  await logActivity(supabase, params.id, "assigned", recruiter.name, {
    from: before?.recruiter?.name ?? null,
    to: after?.name ?? null,
  });

  return Response.json(data);
}
