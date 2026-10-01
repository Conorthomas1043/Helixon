// Candidates to email, with what the merge fields need (lib/email-merge.js):
// their job, the job's hiring contact. Scoped to the agency.

import { supabase } from "@/lib/supabase";

export async function loadEmailTargets(agencyId, candidateIds) {
  if (!candidateIds.length) return [];
  const { data } = await supabase
    .from("candidates")
    .select("id, full_name, name, email, current_title, current_company, stage, recruiter_id, jobs(id, title, client, client_id, location, salary_range, client_contacts(name, email))")
    .eq("agency_id", agencyId)
    .in("id", candidateIds);
  return data ?? [];
}
