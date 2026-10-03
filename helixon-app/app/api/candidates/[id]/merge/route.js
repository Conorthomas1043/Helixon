import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { removeCandidateCvs } from "@/lib/candidate-files";

// POST { otherId } - the same person recorded twice.
//
// Both on the same job (or neither on one): a true duplicate. Everything on
// the other record - notes, activity, interviews, emails, documents,
// placements - moves to this one, blanks here are filled from it, and it's
// deleted (merge_candidates() in migration 20261003010000).
//
// On different jobs: two pipeline entries for one person, which is how the
// app tracks someone screened for several roles. They're linked as the same
// person instead (pooled_from_id - see lib/rescreen.js), so the profile and
// talent pool show them once and subject access / erasure cover both.

const COLUMNS = "id, full_name, name, job_id, pooled_from_id, cv_file_url, jobs(title)";

// The row a person's other records hang off (same rule as lib/rescreen.js).
const poolRootId = (c) => c.pooled_from_id || c.id;

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const keepId = cleanUuid((await params).id);
  const body = (await request.json().catch(() => null)) ?? {};
  const otherId = cleanUuid(body.otherId);
  if (!keepId || !otherId || keepId === otherId) return NextResponse.json({ error: "Pick a different candidate." }, { status: 400 });

  const { data: rows } = await supabase.from("candidates").select(COLUMNS).eq("agency_id", auth.agencyId).in("id", [keepId, otherId]);
  const keep = rows?.find((r) => r.id === keepId);
  const other = rows?.find((r) => r.id === otherId);
  if (!keep || !other) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const otherName = other.full_name || other.name || "candidate";

  if ((keep.job_id ?? null) === (other.job_id ?? null)) {
    const { data, error } = await supabase.rpc("merge_candidates", { p_agency: auth.agencyId, p_keep: keep.id, p_remove: other.id });
    if (error) {
      console.error("[candidates/merge] Merge failed:", error.message);
      const missing = /merge_candidates/.test(error.message) && /function|schema cache/i.test(error.message);
      return NextResponse.json({ error: missing ? "Merging needs a database update first (migration 20261003010000)." : "Couldn't merge them - nothing was changed." }, { status: missing ? 503 : 500 });
    }
    if (data?.orphaned_cv) await removeCandidateCvs([data.orphaned_cv]).catch(() => {});
    await logActivity(supabase, keep.id, "candidate_merged", actor, { note: `Merged the duplicate record for ${otherName} into this one` });
    return NextResponse.json({ ok: true, mode: "merged", moved: data });
  }

  // Different jobs: link the two people's records under one root.
  const keepRoot = poolRootId(keep);
  const otherRoot = poolRootId(other);
  if (keepRoot === otherRoot) return NextResponse.json({ ok: true, mode: "linked", already: true });
  const { error } = await supabase
    .from("candidates")
    .update({ pooled_from_id: keepRoot })
    .eq("agency_id", auth.agencyId)
    .or(`id.eq.${otherRoot},pooled_from_id.eq.${otherRoot}`);
  if (error) return NextResponse.json({ error: "Couldn't link them." }, { status: 500 });
  await logActivity(supabase, keep.id, "candidate_linked", actor, { note: `Linked as the same person as ${otherName}${other.jobs?.title ? ` (${other.jobs.title})` : ""}` });
  await logActivity(supabase, other.id, "candidate_linked", actor, { note: `Linked as the same person as ${keep.full_name || keep.name || "candidate"}` });
  return NextResponse.json({ ok: true, mode: "linked" });
}
