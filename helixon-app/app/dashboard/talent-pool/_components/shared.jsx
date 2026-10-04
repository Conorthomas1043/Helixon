"use client";

// Part of the talent pool page (app/dashboard/talent-pool/page.jsx).

export const AVAILABILITY = {
  available: { label: "Available", fg: "var(--forest-deep)", bg: "var(--mint)", dot: "var(--score-strong)" },
  open: { label: "Open to offers", fg: "#8a5a12", bg: "#fdf6e9", dot: "var(--score-mid)" },
  not_looking: { label: "Not looking", fg: "var(--ink-soft)", bg: "var(--mist)", dot: "var(--ink-faint)" },
};
export const todayIso = () => new Date().toISOString().slice(0, 10);
