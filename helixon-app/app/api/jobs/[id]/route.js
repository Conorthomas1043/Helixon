import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data: job, error } = await supabase.from("jobs").select("*").eq("id", params.id).single();
  if (error || !job) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(job);
}
