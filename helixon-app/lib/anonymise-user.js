// When someone deletes their Helixon account, their profile row stays (the
// agency's candidates and history still point at it) but nothing that
// identifies them should: GDPR erasure applies to recruiters' own data too.
// Called from the Clerk user.deleted webhook (app/api/webhooks/clerk).
//
// - profile: name, username and presence cleared, sign-in detached
// - notes they wrote: author shown as "Former team member"
// - activity history and talent pool entries: their name replaced likewise
//
// Candidates they owned keep recruiter_id (an opaque account id with no
// profile behind it any more) and show as unassigned, so the team can pick
// them up.

import { recruiterDisplayName } from "@/lib/recruiter-directory";

export const FORMER_MEMBER = "Former team member";
const CHUNK = 200;

export async function anonymiseDeletedUser(supabase, clerkUserId) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, agency_id, first_name, last_name, username")
    .eq("clerk_user_id", clerkUserId);
  if (error) throw new Error(error.message);

  for (const profile of profiles || []) {
    const name = recruiterDisplayName(profile);

    // Names in free-text history, scoped to their agency so a namesake
    // elsewhere is never touched.
    if (profile.agency_id) {
      await supabase
        .from("candidate_notes")
        .update({ author_name: FORMER_MEMBER, author_id: null })
        .eq("agency_id", profile.agency_id)
        .eq("author_id", clerkUserId);

      if (name) {
        await supabase.from("candidates").update({ talent_pool_by: FORMER_MEMBER }).eq("agency_id", profile.agency_id).eq("talent_pool_by", name);

        const { data: rows } = await supabase.from("candidates").select("id").eq("agency_id", profile.agency_id);
        const ids = (rows || []).map((r) => r.id);
        for (let i = 0; i < ids.length; i += CHUNK) {
          await supabase.from("candidate_activity").update({ actor: FORMER_MEMBER }).in("candidate_id", ids.slice(i, i + CHUNK)).eq("actor", name);
        }
      }
    }

    await supabase
      .from("profiles")
      .update({
        clerk_user_id: null,
        first_name: null,
        last_name: null,
        // Required and unique - replaced with a placeholder that says nothing
        // about the person.
        username: `deleted-${String(profile.id).slice(0, 8)}`,
        last_seen_at: null,
        last_active_at: null,
        presence_status: null,
        presence_message: null,
        presence_until: null,
      })
      .eq("id", profile.id);
  }
  return (profiles || []).length;
}
