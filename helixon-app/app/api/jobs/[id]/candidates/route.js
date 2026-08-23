import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data, error } = await supabase
    .from("candidates")
    .select("id, full_name, status, stage, match_score, recruiter:recruiters(id, name), created_at")
    .eq("job_id", params.id)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (error) return Response.json({ error: "Failed to load candidates" }, { status: 500 });
  return Response.json(data);
}
