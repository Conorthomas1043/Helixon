// Every mutation route calls this after its own write, so
// candidate_activity and candidates.last_activity_at never drift apart -
// same spirit as the historyVersion/feedbackVersion bump-on-write pattern
// in the current localStorage code, just server-side.
export async function logActivity(supabase, candidateId, type, actor, meta = null) {
  const now = new Date().toISOString();

  await Promise.all([
    supabase.from("candidate_activity").insert({ candidate_id: candidateId, type, actor, meta }),
    supabase.from("candidates").update({ last_activity_at: now }).eq("id", candidateId),
  ]);
}
