"use client";

// Part of the candidate profile page (../page.jsx).

import { STAGE_LABELS } from "@/lib/stage-labels";

export const STAGE_ORDER = Object.keys(STAGE_LABELS);

export const RECENTLY_VIEWED_KEY = "helixon:recently-viewed-candidates";

export function pushRecentlyViewed(id) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing etc.) - non-critical.
  }
}

export function nextStageAfter(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export const OUTREACH_ACTIONS = [
  { type: "call_logged", label: "Log a call" },
  { type: "email_logged", label: "Log an email" },
  { type: "meeting_logged", label: "Log a meeting" },
  { type: "cv_sent_logged", label: "Log CV sent" },
];

/* ------------------------------------------------------------------------
 * Shared bits
 * ---------------------------------------------------------------------- */
