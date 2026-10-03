// Interview self-booking (interview_booking_links, migration
// 20261003010000): a recruiter offers a few times, the candidate picks one
// on a private link and the interview is booked. Pure helpers.

import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { INTERVIEW_KINDS } from "@/lib/interviews";

export const MAX_SLOTS = 12;
const MAX_AHEAD_DAYS = 120;

// The offer from a request body. { error } on invalid input.
export function cleanBookingRequest(body = {}, now = Date.now()) {
  const raw = Array.isArray(body.slots) ? body.slots : [];
  const seen = new Set();
  const slots = [];
  for (const s of raw) {
    const d = typeof s === "string" ? new Date(s) : null;
    if (!d || Number.isNaN(d.getTime())) return { error: "One of the times isn't a date." };
    if (d.getTime() <= now) return { error: "Every time offered must be in the future." };
    if (d.getTime() > now + MAX_AHEAD_DAYS * 86400000) return { error: `Times can be up to ${MAX_AHEAD_DAYS} days ahead.` };
    const iso = d.toISOString();
    if (seen.has(iso)) continue;
    seen.add(iso);
    slots.push(iso);
  }
  if (slots.length === 0) return { error: "Offer at least one time." };
  if (slots.length > MAX_SLOTS) return { error: `Offer up to ${MAX_SLOTS} times.` };
  slots.sort();

  const duration = Number(body.durationMinutes ?? 60);
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) return { error: "Duration must be 5–600 minutes." };
  const kind = INTERVIEW_KINDS[body.kind] ? body.kind : "video";
  let round = null;
  if (body.round != null && body.round !== "") {
    round = Number(body.round);
    if (!Number.isInteger(round) || round < 1 || round > 20) return { error: "Round must be 1–20." };
  }
  // The link stops working when the last time has passed, or after
  // `expiresInDays`, whichever is first.
  const days = Number(body.expiresInDays ?? 7);
  const expiresInDays = Number.isInteger(days) && days >= 1 && days <= 60 ? days : 7;
  const lastSlot = new Date(slots[slots.length - 1]).getTime();
  return {
    slots,
    duration_minutes: duration,
    kind,
    round,
    location: cleanLine(body.location, 500) || null,
    interviewers: cleanLine(body.interviewers, 500) || null,
    contact_id: cleanUuid(body.contactId),
    expires_at: new Date(Math.min(lastSlot, now + expiresInDays * 86400000)).toISOString(),
  };
}

// The times still on offer: in the future and not already taken.
export function openSlots(link, now = Date.now()) {
  if (!link || link.status !== "open") return [];
  if (link.expires_at && new Date(link.expires_at).getTime() < now) return [];
  return (link.slots || []).filter((s) => new Date(s).getTime() > now);
}
