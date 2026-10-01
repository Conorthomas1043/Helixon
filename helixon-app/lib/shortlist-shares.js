// Sharing a shortlist with a client through a private link - see
// supabase/migrations/20261001040000_shortlist_sharing.sql.

import { supabase } from "@/lib/supabase";
import { buildClientProfile, blindLabel } from "@/lib/client-profile";

import { CLIENT_DECISIONS } from "@/lib/client-decisions";

export { CLIENT_DECISIONS };

export const SHARE_TOKEN_RE = /^[a-f0-9]{48}$/;

export function shareActive(share, now = new Date()) {
  if (!share || share.revoked_at) return false;
  return !share.expires_at || new Date(share.expires_at).getTime() > now.getTime();
}

export function toShare(row, url) {
  return {
    id: row.id,
    url,
    blind: row.blind,
    includeConcerns: row.include_concerns,
    showScore: row.show_score,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active: shareActive(row),
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
  };
}

// The client-safe profiles on a shortlist, strongest match first, with the
// client's response so far. Blind shares label people Candidate A, B, ...
export async function sharedProfiles(share) {
  const { data: members } = await supabase
    .from("shortlist_candidates")
    .select(
      "candidate_id, note, client_decision, client_comment, client_decided_at, candidates!inner(id, agency_id, full_name, name, current_title, current_company, location, years_experience, match_score, match_summary, strengths, concerns, extracted, jobs(title, client))"
    )
    .eq("shortlist_id", share.shortlist_id)
    .eq("candidates.agency_id", share.agency_id);
  const rows = (members ?? []).sort((a, b) => (b.candidates.match_score ?? -1) - (a.candidates.match_score ?? -1));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.candidate_id);
  const { data: scores } = await supabase
    .from("scores")
    .select("candidate_id, result, created_at")
    .in("candidate_id", ids)
    .order("created_at", { ascending: false });
  const latest = new Map();
  for (const s of scores ?? []) if (!latest.has(s.candidate_id)) latest.set(s.candidate_id, s.result);

  return rows.map((r, i) => ({
    candidateId: r.candidate_id,
    profile: buildClientProfile(
      { candidate: r.candidates, extracted: r.candidates.extracted, result: latest.get(r.candidate_id) ?? null, job: r.candidates.jobs },
      { blind: share.blind, label: blindLabel(i), includeConcerns: share.include_concerns }
    ),
    note: r.note,
    decision: r.client_decision,
    comment: r.client_comment,
    decidedAt: r.client_decided_at,
  }));
}
