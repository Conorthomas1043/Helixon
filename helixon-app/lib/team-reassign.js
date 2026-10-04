// Bulk candidate reassignment for team changes: handing a removed member's
// candidates to someone else, and picking up candidates nobody on the team
// currently owns (left behind by an earlier removal, or unassigned by hand).
// Without this, a removed member's candidates kept their recruiter_id, their
// card disappeared from the Team page, and the only way back was reassigning
// each candidate from its own profile page.

import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { reportError } from "@/lib/report-error";

const BATCH = 500;

function chunks(list, size = BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// The agency's current members, keyed by Clerk user id.
export async function agencyMembers(supabase, agencyId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("clerk_user_id, first_name, last_name, username")
    .eq("agency_id", agencyId);
  if (error) throw new Error(error.message);
  return new Map((data || []).filter((p) => p.clerk_user_id).map((p) => [p.clerk_user_id, p]));
}

// A reassignment target must be a current member of this agency, so
// candidates can't be handed to someone outside it. null = leave unassigned.
export async function isValidAssignee(supabase, agencyId, clerkUserId) {
  if (clerkUserId === null) return true;
  if (typeof clerkUserId !== "string" || !clerkUserId) return false;
  const members = await agencyMembers(supabase, agencyId);
  return members.has(clerkUserId);
}

// Candidates in this agency that no current member owns: recruiter_id is
// empty, or points at someone who is no longer in the agency.
export async function unassignedCandidateIds(supabase, agencyId) {
  const [members, { data, error }] = await Promise.all([
    agencyMembers(supabase, agencyId),
    supabase.from("candidates").select("id, recruiter_id").eq("agency_id", agencyId),
  ]);
  if (error) throw new Error(error.message);
  return (data || []).filter((c) => !c.recruiter_id || !members.has(c.recruiter_id)).map((c) => c.id);
}

export async function candidateIdsOwnedBy(supabase, agencyId, clerkUserId) {
  const { data, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("recruiter_id", clerkUserId);
  if (error) throw new Error(error.message);
  return (data || []).map((c) => c.id);
}

// Moves the given candidates to toRecruiterId (or unassigns them with null)
// and records it on each candidate's activity timeline, the same "assigned"
// entry a one-by-one reassignment writes. Scoped by agency_id throughout.
export async function reassignCandidates(supabase, {
  agencyId,
  candidateIds,
  toRecruiterId,
  actor,
  fromLabel = null,
}) {
  if (!candidateIds.length) return 0;

  const members = await agencyMembers(supabase, agencyId);
  const toLabel = toRecruiterId ? recruiterDisplayName(members.get(toRecruiterId)) : null;
  const now = new Date().toISOString();

  let moved = 0;
  for (const ids of chunks(candidateIds)) {
    const { data, error } = await supabase
      .from("candidates")
      .update({ recruiter_id: toRecruiterId, last_activity_at: now })
      .eq("agency_id", agencyId)
      .in("id", ids)
      .select("id");
    if (error) throw new Error(error.message);

    const updated = (data || []).map((c) => c.id);
    moved += updated.length;
    if (updated.length) {
      const { error: activityError } = await supabase.from("candidate_activity").insert(
        updated.map((id) => ({
          candidate_id: id,
          type: "assigned",
          actor,
          meta: { from: fromLabel, to: toLabel, bulk: true },
        }))
      );
      // The reassignment itself succeeded - a missing timeline entry isn't
      // worth failing the request over.
      if (activityError) reportError("[team-reassign] Activity insert failed:", activityError.message);
    }
  }
  return moved;
}
