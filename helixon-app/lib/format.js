// Formatting helpers shared by every screen and email. One implementation of
// each, with options for the variants the app uses, instead of a copy per file.

function toDate(value, { dateOnly = false } = {}) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // A plain YYYY-MM-DD (start dates, invoice dates) is a calendar day, not a
  // moment: read it as UTC midnight so no timezone shifts it a day.
  const d = dateOnly ? new Date(`${String(value).slice(0, 10)}T00:00:00Z`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "4 Oct 2026"; { withYear: false } → "4 Oct"; { withTime: true } → "4 Oct,
// 14:05" (no year, as the dashboard shows it). `empty` is what a missing or
// invalid value shows.
/** @param {any} value @param {{ withYear?: boolean, withTime?: boolean, dateOnly?: boolean, empty?: string | null }} [options] */
export function formatDate(value, { withYear = true, withTime = false, dateOnly = false, empty = "-" } = {}) {
  const d = toDate(value, { dateOnly });
  if (!d) return empty;
  /** @type {Intl.DateTimeFormatOptions} */
  const options = withTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) };
  if (dateOnly) options.timeZone = "UTC";
  return d.toLocaleDateString("en-GB", options);
}

// How long ago, in one of the app's four styles:
//   long     "3 minutes ago", "in 2 days"; a date after 30 days (admin)
//   short    "3m ago", "2h ago"; a date after a day (staff call lists)
//   compact  "3m", "2h", "4d" (notification badges)
//   relative "3 min ago", "yesterday", "4 days ago"; a date after a week
/** @param {any} value @param {{ now?: number, style?: "long" | "short" | "compact" | "relative", empty?: string | null }} [options] */
export function timeAgo(value, { now = Date.now(), style = "long", empty } = {}) {
  const d = toDate(value);
  if (!d) return empty !== undefined ? empty : style === "long" ? (value ? "-" : "never") : null;
  const ms = now - d.getTime();
  const mins = Math.round(ms / 60_000);

  if (style === "long") {
    const seconds = Math.round(ms / 1000);
    const abs = Math.abs(seconds);
    if (abs < 45) return "just now";
    if (abs >= 86400 * 30) return formatDate(d);
    const [size, unit] = abs < 3600 ? [60, "minute"] : abs < 86400 ? [3600, "hour"] : [86400, "day"];
    const count = Math.max(1, Math.round(abs / size));
    const label = `${count} ${unit}${count === 1 ? "" : "s"}`;
    return seconds >= 0 ? `${label} ago` : `in ${label}`;
  }
  if (style === "compact") {
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const h = Math.round(mins / 60);
    return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
  }
  if (style === "short") {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    return hours < 24 ? `${hours}h ago` : formatDate(d, { withYear: false });
  }
  // relative
  const m = Math.max(0, mins);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const hours = Math.round(m / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d, { withYear: false });
}

// "AL" for "Ada Lovelace"; "?" when there's no name.
export function initials(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?"
  );
}

// For putting user text into an HTML email.
export function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
