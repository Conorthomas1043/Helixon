// Small facts about a candidate worked out from their timeline, for the
// profile header: when they were last contacted, and how long they've
// been in their current stage. Pure, so tested.

const DAY = 86400000;

export const CONTACT_TYPES = new Set([
  "call_logged",
  "sms_logged",
  "whatsapp_logged",
  "email_logged",
  "meeting_logged",
  "cv_sent_logged",
  "email_received",
  "email_sent",
  "interview_scheduled",
]);

const ts = (a) => new Date(a.timestamp || a.created_at || a.createdAt || 0).getTime();

// The most recent contact, or null. activity: [{ type, timestamp }]
export function lastContact(activity = []) {
  let best = null;
  for (const a of activity) {
    if (!CONTACT_TYPES.has(a.type)) continue;
    const t = ts(a);
    if (Number.isFinite(t) && t > 0 && (!best || t > best.at)) best = { at: t, type: a.type };
  }
  return best;
}

// Whole days since the last move into their current stage (or since they
// were added, when there's no recorded move).
export function daysInStage(candidate, now = Date.now()) {
  if (!candidate?.stage) return null;
  let since = null;
  for (const a of candidate.activity || []) {
    if (a.type !== "stage_changed" || a.meta?.to !== candidate.stage) continue;
    const t = ts(a);
    if (Number.isFinite(t) && (!since || t > since)) since = t;
  }
  if (!since) since = new Date(candidate.createdAt || 0).getTime();
  if (!Number.isFinite(since) || since <= 0) return null;
  return Math.max(0, Math.floor((now - since) / DAY));
}

export function agoLabel(at, now = Date.now()) {
  const days = Math.floor((now - at) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

// A LinkedIn profile as a link, whatever form it was typed in.
export function linkedinUrl(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return /linkedin\.com/i.test(v) ? v : null;
  if (/^(www\.)?linkedin\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "www.")}`;
  if (/^[\w-]{3,100}$/.test(v)) return `https://www.linkedin.com/in/${v}`;
  return null;
}
