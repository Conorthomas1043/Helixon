import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";

export async function POST(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { body } = await request.json();
  if (!body?.trim()) return Response.json({ error: "Note body required" }, { status: 400 });

  const { data, error } = await supabase
    .from("candidate_notes")
    .insert({
      candidate_id: params.id,
      author_id: recruiter.id,
      author_name: recruiter.name,
      body: body.trim(),
    })
    .select()
    .single();

  if (error) return Response.json({ error: "Failed to save note" }, { status: 500 });

  await logActivity(supabase, params.id, "note_added", recruiter.name);

  return Response.json(data);
}
