import { supabase } from "@/lib/supabase";

// GET - returns all shortlists for an agency, with their candidates nested inside
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get("agencyId");

  const { data, error } = await supabase
    .from("shortlists")
    .select(`
      *,
      jobs(title),
      shortlist_candidates(
        *,
        candidates(name, extracted),
        scores(match_score, recommendation, result)
      )
    `)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, shortlists: data });
}

// POST - creates a new shortlist
export async function POST(request) {
  const { agencyId, jobId, name } = await request.json();

  const { data, error } = await supabase
    .from("shortlists")
    .insert({ agency_id: agencyId, job_id: jobId, name })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, shortlist: data });
}