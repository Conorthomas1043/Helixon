// Loading an interview (with its candidate, job and contact) for the
// interview API routes, scoped to the caller's agency.

import { supabase } from "@/lib/supabase";
import { cleanUuid } from "@/lib/sanitize";
import { summariseScorecards, toInterview, toScorecard } from "@/lib/interviews";

export const INTERVIEW_SELECT =
  "*, candidates(id, full_name, name, email, stage, recruiter_id, job_id), jobs(id, title, client, client_id), client_contacts(id, name, email)";

export async function loadInterview(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("interviews").select(INTERVIEW_SELECT).eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

// Who gets the invite: the candidate and the hiring contact (when asked
// for and they have an email), plus any extra addresses.
export function inviteRecipients(interview, { candidate = true, contact = true, extra = [] } = {}) {
  const out = [];
  const seen = new Set();
  const add = (email, name, audience) => {
    const e = String(email || "").trim().toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push({ email: e, name: name || null, audience });
  };
  if (candidate) add(interview.candidates?.email, interview.candidates?.full_name || interview.candidates?.name, "candidate");
  if (contact) add(interview.client_contacts?.email, interview.client_contacts?.name, "client");
  for (const e of extra) add(e, null, "client");
  return out;
}

// API shape: the interview plus who/what it is for and its scorecards.
export function shapeInterview(row, recruiterNames = new Map(), { includeTokens = false } = {}) {
  const cards = (row.interview_feedback ?? []).map((f) => toScorecard(f, { includeToken: includeTokens }));
  return {
    ...toInterview(row),
    candidateName: row.candidates?.full_name || row.candidates?.name || "Candidate",
    candidateEmail: row.candidates?.email ?? null,
    recruiterName: recruiterNames.get(row.candidates?.recruiter_id) ?? null,
    jobTitle: row.jobs?.title ?? null,
    client: row.jobs?.client ?? null,
    clientId: row.jobs?.client_id ?? null,
    contactName: row.client_contacts?.name ?? null,
    contactEmail: row.client_contacts?.email ?? null,
    scorecards: cards,
    scorecardSummary: summariseScorecards(cards),
  };
}

