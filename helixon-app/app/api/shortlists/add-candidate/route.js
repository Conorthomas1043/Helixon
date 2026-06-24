import { supabase } from "@/lib/supabase";

// POST — adds a candidate to a shortlist (prevents duplicates)
export async function POST(request) {
  const { shortlistId, candidateId, scoreId, note } = await request.json();

  // Check if candidate is already on this shortlist
  const { data: existing } = await supabase
    .from("shortlist_candidates")
    .select("id")
    .eq("shortlist_id", shortlistId)
    .eq("candidate_id", candidateId)
    .single();

  if (existing) {
    return Response.json({ ok: false, error: "Already on shortlist" });
  }

  const { data, error } = await supabase
    .from("shortlist_candidates")
    .insert({
      shortlist_id: shortlistId,
      candidate_id: candidateId,
      score_id: scoreId || null,
      note: note || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, entry: data });
}