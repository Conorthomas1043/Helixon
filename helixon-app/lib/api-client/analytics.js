"use client";

// Dashboard API calls: analytics (re-exported by lib/dashboard-api.js).

import { apiFetch, jsonBody } from "./core";

// Analytics page filters -> query string for both analytics endpoints.
//   { period: "all" | "30d" | "90d" | "365d" | "custom", from, to
//     (YYYY-MM-DD, custom only), jobId, recruiterId, clientId }
export function analyticsQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  for (const key of ["jobId", "recruiterId", "clientId", "officeId"]) {
    if (filters[key] && filters[key] !== "all") params.set(key, filters[key]);
  }
  return params.toString();
}

// Speed/efficiency, outreach, sourcing, financial, retention and feedback
// figures (app/api/analytics/timing). Fails soft: a broken or slow timing
// query shouldn't blank out the rest of the Analytics page, which has real
// value without it.
export async function getTimingSnapshot(filters = {}) {
  try {
    const data = await apiFetch(`/api/analytics/timing?${analyticsQuery(filters)}`);
    if (!data.ok) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * getAnalyticsSnapshot - the Analytics page's numbers. The headline
 * figures (funnel, conversion, quality, pipeline, score calibration, team,
 * trends and changes vs the previous period) are worked out server-side by
 * app/api/analytics/snapshot from the stage-change history; the rest come
 * from app/api/analytics/timing.
 */
export async function getAnalyticsSnapshot(filters = {}) {
  const [snapshot, timing] = await Promise.all([
    apiFetch(`/api/analytics/snapshot?${analyticsQuery(filters)}`),
    getTimingSnapshot(filters),
  ]);
  if (!snapshot?.ok) throw new Error(snapshot?.error || "Failed to load analytics");
  return { ...snapshot, timing };
}

// Open follow-ups (next actions + talent-pool check-ins) - see
// app/api/follow-ups. scope: "mine" (assigned to me) or "all".
export async function getFollowUps(scope = "mine") {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return apiFetch(`/api/follow-ups?scope=${scope}&tz=${encodeURIComponent(tz)}`);
}

// Performance, targets and commission - see app/api/performance.
export async function getPerformance(period) {
  return apiFetch(`/api/performance?period=${encodeURIComponent(period || "this_month")}`);
}

export async function getPerformanceSettings() {
  return apiFetch("/api/performance/settings");
}

export async function savePerformanceSettings(fields) {
  return apiFetch("/api/performance/settings", jsonBody("PUT", fields));
}
