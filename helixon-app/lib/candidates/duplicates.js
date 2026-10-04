// Spotting a person who's already on file when a new CV is uploaded
// (app/api/run). A match on email or LinkedIn profile links the new
// candidate row to that person through pooled_from_id - the same link a
// re-screen from the talent pool makes (lib/rescreen.js) - so their profile
// lists every role they've been screened for, the talent pool shows them
// once, and subject access / erasure (lib/candidates/person.js) cover every
// row.
//
// Names alone are never enough (two different people share names), and
// phone numbers are written too many ways to match reliably in the
// database, so only email and LinkedIn count.

import { quoted } from "@/lib/candidates/search";

export function normaliseEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// The profile handle from any form of LinkedIn URL ("linkedin.com/in/x",
// "https://uk.linkedin.com/in/x/", "www.linkedin.com/in/x?trk=…").
export function linkedInHandle(value) {
  const m = typeof value === "string" ? value.toLowerCase().match(/linkedin\.com\/in\/([a-z0-9\-_%]+)/) : null;
  return m && m[1].length >= 3 ? m[1] : null;
}

// The PostgREST .or() filter that finds candidate rows sharing an email or
// LinkedIn handle with `extracted`, or null when it has neither.
export function duplicateFilter(extracted = {}) {
  const parts = [];
  const email = normaliseEmail(extracted.email);
  const handle = linkedInHandle(extracted.linkedin);
  if (email) parts.push(`email.ilike.${quoted(email.replace(/[\\%_]/g, "\\$&"))}`);
  if (handle) parts.push(`linkedin.ilike.${quoted(`%linkedin.com/in/${handle.replace(/[\\%_]/g, "\\$&")}%`)}`);
  return parts.length ? parts.join(",") : null;
}

// From candidate rows the filter found, the person `extracted` matches:
// { rootId, matchedOn } or null. Rows are re-checked here (the database
// match is case-insensitive LIKE) and the person's root row - the one every
// other row links back to - is what's returned.
export function pickExistingPerson(rows, extracted = {}) {
  const email = normaliseEmail(extracted.email);
  const handle = linkedInHandle(extracted.linkedin);
  const roots = new Map();
  for (const row of rows || []) {
    const onEmail = email && normaliseEmail(row.email) === email;
    const onLinkedIn = handle && linkedInHandle(row.linkedin) === handle;
    if (!onEmail && !onLinkedIn) continue;
    const rootId = row.pooled_from_id || row.id;
    const prev = roots.get(rootId) || { rootId, onEmail: false, onLinkedIn: false, createdAt: row.created_at };
    roots.set(rootId, {
      ...prev,
      onEmail: prev.onEmail || Boolean(onEmail),
      onLinkedIn: prev.onLinkedIn || Boolean(onLinkedIn),
      createdAt: String(row.created_at ?? "") < String(prev.createdAt ?? "") ? row.created_at : prev.createdAt,
    });
  }
  if (roots.size === 0) return null;
  // More than one person matched (e.g. a shared inbox) - take the oldest.
  const best = [...roots.values()].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))[0];
  const matchedOn = best.onEmail && best.onLinkedIn ? "email and LinkedIn" : best.onEmail ? "email" : "LinkedIn";
  return { rootId: best.rootId, matchedOn };
}

// Looks the person up in the agency. Never throws - a failed lookup just
// means the upload isn't linked.
export async function findExistingPerson(supabase, agencyId, extracted) {
  const filter = duplicateFilter(extracted);
  if (!filter) return null;
  const { data, error } = await supabase
    .from("candidates")
    .select("id, pooled_from_id, email, linkedin, created_at")
    .eq("agency_id", agencyId)
    .or(filter)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) {
    console.warn("[duplicates] Lookup failed:", error.message);
    return null;
  }
  return pickExistingPerson(data, extracted);
}
