// Team presence, worked out from what each browser reports
// (app/api/team/presence) - shared by the server (Team API) and the page.
//
//   active   a Helixon tab is open and they've used it in the last 5 minutes
//   idle     a tab is open but untouched for 5+ minutes
//   busy     they set themselves busy (until a time, or until they change it)
//   away     they set themselves away
//   offline  no open tab - shown with when they were last active
//   hidden   they've chosen not to share their presence (nothing is
//            recorded - app/api/team/presence)
//
// Open tabs send a heartbeat every minute, so "online" allows a little over
// two missed beats before someone counts as gone.

import { timeAgo as fmtTimeAgo } from "@/lib/format";

export const timeAgo = (iso, now = Date.now()) => fmtTimeAgo(iso, { now, style: "relative" });
export const HEARTBEAT_MS = 60_000;
export const ONLINE_WINDOW_MS = 150_000;
export const IDLE_AFTER_MS = 5 * 60_000;

export const PRESENCE_LABELS = {
  active: "Active",
  idle: "Idle",
  busy: "Busy",
  away: "Away",
  offline: "Offline",
  hidden: "Hidden",
};

// Order for sorting a team list: who can respond now first.
export const PRESENCE_ORDER = ["active", "busy", "idle", "away", "offline", "hidden"];

function time(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

// p: { lastSeenAt, lastActiveAt, status: "busy" | "away" | null, message, until }
// Returns { state, online, lastActiveAt, idleSince, message, until }
export function computePresence(p = {}, now = Date.now()) {
  if (p.hidden) return { state: "hidden", online: false, lastActiveAt: null, message: null, until: null };
  const seen = time(p.lastSeenAt);
  const active = time(p.lastActiveAt);
  const until = time(p.until);
  const online = seen !== null && now - seen <= ONLINE_WINDOW_MS;
  // A busy/away status that has run out no longer applies.
  const manual = p.status && (until === null || until > now) ? p.status : null;
  const lastActiveAt = active ?? seen;

  let state;
  if (!online) state = manual === "away" ? "away" : "offline";
  else if (manual) state = manual;
  else if (lastActiveAt !== null && now - lastActiveAt >= IDLE_AFTER_MS) state = "idle";
  else state = "active";

  return {
    state,
    online,
    lastActiveAt: lastActiveAt !== null ? new Date(lastActiveAt).toISOString() : null,
    message: manual ? p.message || null : null,
    until: manual && until !== null ? new Date(until).toISOString() : null,
  };
}

// One line describing someone's presence for the Team page.
export function presenceLine(p, now = Date.now()) {
  switch (p.state) {
    case "active":
      return "Active now";
    case "idle":
      return `Idle · last active ${timeAgo(p.lastActiveAt, now)}`;
    case "busy":
    case "away": {
      const label = PRESENCE_LABELS[p.state];
      const untilText = p.until
        ? ` until ${new Date(p.until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      return `${label}${untilText}${!p.online && p.lastActiveAt ? ` · last active ${timeAgo(p.lastActiveAt, now)}` : ""}`;
    }
    case "hidden":
      return "Presence hidden";
    default:
      return p.lastActiveAt ? `Last active ${timeAgo(p.lastActiveAt, now)}` : "Not seen yet";
  }
}
