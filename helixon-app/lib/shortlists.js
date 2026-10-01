// Shared by the shortlist API routes (app/api/shortlists/*). A shortlist is
// a named, agency-owned list of candidates - usually the handful being put
// forward to a client for one job - stored in `shortlists` and
// `shortlist_candidates` (one row per candidate on the list, with an
// optional note on why they're on it).

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

export const MAX_NAME_LEN = 120;
export const MAX_NOTE_LEN = 1000;
// One request can add at most this many people (bulk "Add to shortlist").
export const MAX_ADD = 100;

// The signed-in agency member, or an error response.
export async function shortlistAuth() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  return { auth };
}

// The agency's shortlist `id` (with its job), or an error response.
export async function loadShortlist(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const { data, error } = await supabase
    .from("shortlists")
    .select("id, name, job_id, created_at, jobs(id, title, client, client_email)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ error: "Failed to load shortlist." }, { status: 500 }) };
  if (!data) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { shortlist: data };
}

// A job id the agency owns, null for "no job", or { error } when it isn't theirs.
export async function ownedJobId(agencyId, rawJobId) {
  if (rawJobId === undefined) return undefined;
  if (rawJobId === null || rawJobId === "") return null;
  const jobId = cleanUuid(rawJobId);
  if (!jobId) return { error: true };
  const { data } = await supabase.from("jobs").select("id").eq("id", jobId).eq("agency_id", agencyId).maybeSingle();
  return data ? jobId : { error: true };
}

export function toShortlist(row, members = []) {
  return {
    id: row.id,
    name: row.name,
    jobId: row.job_id,
    jobTitle: row.jobs?.title ?? null,
    client: row.jobs?.client ?? null,
    clientEmail: row.jobs?.client_email ?? null,
    createdAt: row.created_at,
    count: members.length,
  };
}

// Puts the agency's candidates `rawIds` on shortlist `shortlistId` (which
// the caller has already checked is the agency's). People already on it are
// skipped, so adding twice is harmless. Logs "Added to shortlist" on each
// newly added candidate. Returns { added } or { error, status }.
export async function addToShortlist(auth, shortlistId, rawIds, note, shortlistName = null) {
  const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(cleanUuid).filter(Boolean))];
  if (ids.length === 0) return { error: "Choose who to add.", status: 400 };
  if (ids.length > MAX_ADD) return { error: `Add up to ${MAX_ADD} people at a time.`, status: 400 };

  const [{ data: owned, error: ownErr }, { data: existing, error: exErr }] = await Promise.all([
    supabase.from("candidates").select("id").eq("agency_id", auth.agencyId).in("id", ids),
    supabase.from("shortlist_candidates").select("candidate_id").eq("shortlist_id", shortlistId).in("candidate_id", ids),
  ]);
  if (ownErr || exErr) return { error: "Failed to add to shortlist.", status: 500 };
  if ((owned ?? []).length !== ids.length) return { error: "Some of those candidates weren't found.", status: 404 };

  const already = new Set((existing ?? []).map((r) => r.candidate_id));
  const fresh = ids.filter((id) => !already.has(id));
  if (fresh.length === 0) return { added: 0 };

  const { error } = await supabase
    .from("shortlist_candidates")
    .insert(fresh.map((candidateId) => ({ shortlist_id: shortlistId, candidate_id: candidateId, note: note || null })));
  if (error) return { error: "Failed to add to shortlist.", status: 500 };

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  await Promise.all(
    fresh.map((candidateId) =>
      logActivity(supabase, candidateId, "shortlist_added", actor, shortlistName ? { note: shortlistName } : null)
    )
  );
  return { added: fresh.length };
}
