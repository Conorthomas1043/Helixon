/* ------------------------------------------------------------------------
 * candidate-format.js
 * ------------------------------------------------------------------------
 * Small, dependency-free formatting/scoring helpers shared by the
 * candidate database, candidate workspace, and (eventually) the jobs and
 * analytics pages. Pulled out of dashboard/page.js's local copies so the
 * new candidate pages don't fork the logic — dashboard/page.js can adopt
 * these too when it's next touched, but it hasn't been changed here to
 * keep this change-set focused.
 * ---------------------------------------------------------------------- */

export const INK = "#13201b";
export const INK_MUTED = "#5a7a6a";
export const INK_FAINT = "#8aaa9a";
export const AMBER = "#c9922e";
export const AMBER_BG = "#fff8e6";
export const RED = "#c0392b";
export const RED_STRONG = "#b91c1c";
export const RED_BG = "#fef2f2";
export const GREEN_BG = "#eef7f1";

export const CARD = {
  background: "white",
  border: "1px solid var(--border)",
};

export function formatDate(date) {
  if (!date) return "Unknown date";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(date) {
  if (!date) return "Unknown date";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(date) {
  if (!date) return "Unknown date";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateOnly(d);
}

export function dayBucketLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDateOnly(d);
}

export function scoreColor(score) {
  if (score === null || score === undefined) return INK_FAINT;
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return AMBER;
  return RED;
}

export function scoreLabel(score) {
  if (score === null || score === undefined) return "No score";
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Moderate match";
  return "Weak match";
}

export function scoreBandOf(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return "80+";
  if (score >= 60) return "60-79";
  return "<60";
}

export function truncate(text, max = 42) {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Human label + tone for an activity-log event type. Only covers event
 * types actually produced by lib/mock-data.js's mutation helpers — add a
 * case here whenever a new event type is introduced there. */
export function activityMeta(type) {
  const map = {
    analysis_completed: { label: "Analysis completed", tone: "neutral" },
    stage_changed: { label: "Stage changed", tone: "forest" },
    note_added: { label: "Note added", tone: "neutral" },
    assigned: { label: "Assigned", tone: "neutral" },
    tag_added: { label: "Tag added", tone: "neutral" },
    tag_removed: { label: "Tag removed", tone: "neutral" },
    next_action_set: { label: "Next action set", tone: "amber" },
    next_action_completed: { label: "Next action completed", tone: "forest" },
    cv_uploaded: { label: "CV uploaded", tone: "neutral" },
  };
  return map[type] ?? { label: type, tone: "neutral" };
}
