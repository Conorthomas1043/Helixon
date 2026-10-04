// Permanently erases candidates and every row that references them - the
// tool an agency needs to fulfil a data subject's right to erasure. Shared by
// the single delete (app/api/candidates/[id]) and bulk delete
// (app/api/candidates/bulk), so the two can't drift apart.
//
// candidates.id is referenced by scores, artifacts, shortlist_candidates and
// candidate_notes with NO ACTION (not cascade); scores.id is in turn
// referenced by feedback and shortlist_candidates, also NO ACTION - so these
// are cleared explicitly first, leaves before roots. candidate_activity and
// feedback_requests cascade. Not one DB transaction (supabase-js has none):
// a failed step stops the erasure and says which step, so it can be retried
// rather than reported as done.

import { removeCandidateCvs } from "@/lib/candidates/files";
import { removeComplianceDocuments } from "@/lib/compliance-files";
import { reportError } from "@/lib/report-error";

const BATCH = 200;

function chunks(list, size = BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Returns { erased, failedStep?, storageError? }. Only ids belonging to
// agencyId are touched; anything else is silently ignored.
export async function eraseCandidates(supabase, agencyId, candidateIds) {
  let erased = 0;

  for (const batch of chunks([...new Set(candidateIds)])) {
    const { data: owned, error: lookupError } = await supabase
      .from("candidates")
      .select("id, cv_file_url")
      .eq("agency_id", agencyId)
      .in("id", batch);
    if (lookupError) return { erased, failedStep: "lookup" };
    const ids = (owned || []).map((c) => c.id);
    if (ids.length === 0) continue;

    const { data: scoreRows, error: scoreLookupError } = await supabase
      .from("scores")
      .select("id")
      .in("candidate_id", ids);
    if (scoreLookupError) return { erased, failedStep: "scores lookup" };
    const scoreIds = (scoreRows || []).map((s) => s.id);

    const steps = [
      ...(scoreIds.length
        ? [
            ["feedback", (q) => q.in("score_id", scoreIds)],
            ["shortlist_candidates", (q) => q.in("score_id", scoreIds)],
          ]
        : []),
      ["shortlist_candidates", (q) => q.in("candidate_id", ids)],
      ["scores", (q) => q.in("candidate_id", ids)],
      ["artifacts", (q) => q.in("candidate_id", ids)],
      ["candidate_notes", (q) => q.in("candidate_id", ids)],
    ];
    for (const [table, where] of steps) {
      const { error } = await where(supabase.from(table).delete());
      if (error) {
        reportError(`[candidate-erasure] Failed clearing ${table}:`, error.message);
        return { erased, failedStep: table };
      }
    }

    // Compliance checks go with the candidate (cascade); their stored
    // documents are collected first so they can be removed too. Before the
    // compliance migration the table doesn't exist - nothing to collect.
    const { data: docs } = await supabase.from("compliance_checks").select("document_path").in("candidate_id", ids).not("document_path", "is", null);

    const { error: deleteError } = await supabase.from("candidates").delete().eq("agency_id", agencyId).in("id", ids);
    if (deleteError) {
      reportError("[candidate-erasure] Failed deleting candidates:", deleteError.message);
      return { erased, failedStep: "candidates" };
    }
    erased += ids.length;

    // In-app notifications about them (they name the person). Best effort:
    // the table only exists after migration 20261003010000.
    await supabase.from("notifications").delete().eq("agency_id", agencyId).in("href", ids.map((id) => `/dashboard/candidates/${id}`));

    // Files go after the records, so a storage hiccup can't leave a
    // half-deleted candidate; a failure is logged for manual follow-up.
    const storageError =
      (await removeCandidateCvs((owned || []).map((c) => c.cv_file_url))) || (await removeComplianceDocuments((docs || []).map((d) => d.document_path)));
    if (storageError) {
      reportError("[candidate-erasure] Candidates erased but CV file removal failed:", storageError.message);
    }
  }

  return { erased };
}
