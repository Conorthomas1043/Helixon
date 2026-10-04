/* ------------------------------------------------------------------------
 * candidate-format.js
 * ------------------------------------------------------------------------
 * Small, dependency-free formatting/scoring helpers shared by the
 * candidate database, candidate workspace, and the jobs, pipeline, team,
 * and analytics pages.
 *
 * The color constants below point at the same CSS tokens defined in
 * app/globals.css (--ink, --ink-soft, --ink-faint, --score-mid,
 * --score-low, --mint) rather than their own hardcoded hex, so every page
 * importing this file automatically stays in sync with the design system
 * instead of forking a second, slightly-different palette.
 * ---------------------------------------------------------------------- */

import { STRONG_MATCH_MIN, REVIEW_MIN, scoreBandLabel } from "./scoreBands";
import { formatDate as fmtDate, initials } from "@/lib/format";

export const formatDate = (date) => fmtDate(date, { withTime: true, empty: "Unknown date" });
export { initials };

export const INK = "var(--ink)";
export const INK_MUTED = "var(--ink-soft)";
export const INK_FAINT = "var(--ink-faint)";
export const AMBER = "var(--score-mid)";
export const AMBER_BG = "#fff8e6";
export const RED = "var(--score-low)";
export const RED_STRONG = "#b91c1c";
export const RED_BG = "#fef2f2";
export const GREEN_BG = "var(--mint)";

export const CARD = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
};

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
  if (score >= STRONG_MATCH_MIN) return "var(--forest)";
  if (score >= REVIEW_MIN) return AMBER;
  return RED;
}

export function scoreLabel(score) {
  return scoreBandLabel(score);
}

export function scoreBandOf(score) {
  if (score === null || score === undefined) return null;
  if (score >= STRONG_MATCH_MIN) return `${STRONG_MATCH_MIN}+`;
  if (score >= REVIEW_MIN) return `${REVIEW_MIN}-${STRONG_MATCH_MIN - 1}`;
  return `<${REVIEW_MIN}`;
}

export function truncate(text, max = 42) {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Human label + tone for an activity-log event type. Only covers event
 * types actually produced by lib/mock-data.js's mutation helpers - add a
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
