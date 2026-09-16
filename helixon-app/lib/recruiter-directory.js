// Shared helper for resolving `candidates.recruiter_id` (a Clerk user id -
// see app/api/run) into a display name. There is no `recruiters` table in
// the live Clerk-based flow - "the team" is just the profiles that share an
// agency_id. Extracted from the lookup app/api/dashboard-stats already used
// so the candidates/jobs/team API routes don't each reimplement it.

export function recruiterDisplayName(profile) {
  if (!profile) return null;
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || null;
}

export async function resolveRecruiterNames(supabase, clerkIds) {
  const ids = [...new Set((clerkIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("clerk_user_id, first_name, last_name, username")
    .in("clerk_user_id", ids);

  return new Map((profiles ?? []).map((p) => [p.clerk_user_id, recruiterDisplayName(p)]));
}
