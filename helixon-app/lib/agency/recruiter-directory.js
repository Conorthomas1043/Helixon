// Shared helper for resolving `candidates.recruiter_id` (a Clerk user id -
// see app/api/run) into a display name. There is no `recruiters` table in
// the live Clerk-based flow - "the team" is just the profiles that share an
// agency_id. Extracted from the lookup app/api/dashboard-stats already used
// so the candidates/jobs/team API routes don't each reimplement it.

export function recruiterDisplayName(profile) {
  if (!profile) return null;
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || null;
}

// With `agencyId`, only that agency's members are named - for ids taken
// from a field a member could set to anyone's id.
export async function resolveRecruiterNames(supabase, clerkIds, agencyId = null) {
  const ids = [...new Set((clerkIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();

  let query = supabase
    .from("profiles")
    .select("clerk_user_id, first_name, last_name, username")
    .in("clerk_user_id", ids);
  if (agencyId) query = query.eq("agency_id", agencyId);
  const { data: profiles } = await query;

  return new Map((profiles ?? []).map((p) => [p.clerk_user_id, recruiterDisplayName(p)]));
}
