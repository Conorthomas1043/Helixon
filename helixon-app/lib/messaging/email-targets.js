// Candidates to email, with what the merge fields need (lib/messaging/email-merge.js):
// their job, the job's hiring contact. Scoped to the agency, and to the
// member's own candidates when "own candidates only" is on.

import "server-only";
import { supabase } from "@/lib/supabase";
import { getAccess, scopeCandidateQuery } from "@/lib/agency/permissions";

export async function loadEmailTargets(auth, candidateIds) {
  if (!candidateIds.length) return [];
  const query = supabase
    .from("candidates")
    .select("id, full_name, name, email, current_title, current_company, stage, recruiter_id, jobs(id, title, client, client_id, location, salary_range, client_contacts(name, email))")
    .eq("agency_id", auth.agencyId)
    .in("id", candidateIds);
  const { data } = await scopeCandidateQuery(query, await getAccess(auth), auth);
  return data ?? [];
}
