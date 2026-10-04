"use client";

// Part of the dashboard home (app/dashboard/page.js).

import { REVIEW_MIN, STRONG_MATCH_MIN } from "@/lib/scoreBands";
import { formatDate as fmtDate } from "@/lib/format";

export const formatDate = (date) => fmtDate(date, { withTime: true });

/* ─── Design tokens ─────────────────────────────────────────────────────── */

export const BG        = "var(--mist)";
export const SURFACE   = "var(--bg)";
export const SURFACE2  = "var(--mist)";
export const BORDER    = "var(--border)";
export const BORDER2   = "var(--border-soft)";

export const TEXT      = "var(--ink)";
export const TEXT_SUB  = "var(--ink-soft)";
export const TEXT_FAINT= "var(--ink-faint)";

export const ACCENT    = "var(--forest)";
export const ACCENT_FG = "var(--forest)";
export const ACCENT_BG = "var(--mint)";

export const GOLD      = "var(--gold)";

export const GREEN     = "var(--score-strong)";
export const GREEN_FG  = "var(--score-strong)";
export const GREEN_BG  = "var(--mint)";

export const AMBER_FG  = "var(--score-mid)";
export const AMBER_BG  = "rgba(180,83,9,0.10)";

export const RED       = "var(--score-low)";
export const RED_STRONG= "var(--score-low)";
export const RED_BG    = "rgba(192,57,43,0.10)";

export const CARD = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
};

export function formatNumber(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-GB");
}

export function scoreColor(score) {
  if (score === null || score === undefined) return TEXT_FAINT;
  if (score >= STRONG_MATCH_MIN) return GREEN_FG;
  if (score >= REVIEW_MIN) return AMBER_FG;
  return RED;
}

/* ─── Business view (app/api/dashboard-ops) ─────────────────────────────── */

export function formatMoneyShort(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n || 0));
}
