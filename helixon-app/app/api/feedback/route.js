import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
    const { scoreId, agencyId, rating, comment } = await request.json();

    // update the score row with the feedback
    await supabase
      .from("scores")
      .update({ recruiter_feedback: rating })
      .eq("id", scoreId);

    // also save to the feedback table
    await supabase.from("feedback").insert({
      score_id: scoreId,
      agency_id: agencyId,
      rating,
      comment: comment || null
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}