import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, job:jobs(*), recruiter:recruiters(id, name)")
    .eq("id", params.id)
    .single();

  if (error || !candidate) return Response.json({ error: "Not found" }, { status: 404 });

  const [{ data: notes }, { data: activity }] = await Promise.all([
    supabase
      .from("candidate_notes")
      .select("id, author_name, body, created_at")
      .eq("candidate_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_activity")
      .select("id, type, actor, meta, created_at")
      .eq("candidate_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  return Response.json({ ...candidate, notes: notes ?? [], activity: activity ?? [] });
}
