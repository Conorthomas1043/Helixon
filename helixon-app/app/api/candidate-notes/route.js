import { supabase } from "@/lib/supabase";

// GET - returns all notes for a specific candidate
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidateId");

  const { data, error } = await supabase
    .from("candidate_notes")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, notes: data });
}

// POST - saves a new note against a candidate
export async function POST(request) {
  const { agencyId, candidateId, note } = await request.json();

  const { data, error } = await supabase
    .from("candidate_notes")
    .insert({ agency_id: agencyId, candidate_id: candidateId, note })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, note: data });
}