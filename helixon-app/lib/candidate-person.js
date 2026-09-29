// A "person" in Helixon can be several candidate rows: the one first
// screened, plus a row per job they were later screened for from the CV on
// file (lib/rescreen.js, linked by pooled_from_id). Subject access requests
// and erasure have to cover all of them, not just the row being viewed.

import { poolRootId } from "@/lib/rescreen";

// Every candidate row for the person `candidateId` belongs to, within the
// agency. [] if the candidate isn't the agency's.
export async function personCandidateIds(supabase, agencyId, candidateId) {
  const { data: row } = await supabase
    .from("candidates")
    .select("id, pooled_from_id")
    .eq("id", candidateId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!row) return [];
  const rootId = poolRootId(row);
  const { data: linked, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .or(`id.eq.${rootId},pooled_from_id.eq.${rootId}`);
  if (error) throw new Error(error.message);
  return [...new Set([candidateId, ...(linked || []).map((r) => r.id)])];
}
