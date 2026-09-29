// lib/ops/health-grade.js
// Turns the /api/admin/health snapshot into one overall status. Shared by
// the API (which records each run for the history strip) and the admin
// pages (desktop and mobile), so they can never disagree.
//
// Critical checks (the database and the AI providers the product runs on)
// make the site "critical" when down; the others make it "degraded". An
// admin can mute a check on /admin/health - it's still shown, but no longer
// affects the overall status (e.g. a provider you've stopped using).

export const HEALTH_CHECKS = [
  { key: "database", label: "Database", critical: true, pick: (h) => h?.database },
  { key: "anthropic", label: "Anthropic", critical: true, pick: (h) => h?.aiProviders?.anthropic },
  { key: "gemini", label: "Gemini", critical: true, pick: (h) => h?.aiProviders?.gemini },
  { key: "stripe", label: "Stripe", critical: false, pick: (h) => h?.stripe },
  { key: "clerk", label: "Clerk", critical: false, pick: (h) => h?.clerk },
  { key: "redis", label: "Redis", critical: false, pick: (h) => h?.redis },
  { key: "resend", label: "Resend", critical: false, pick: (h) => h?.resend },
  { key: "sentry", label: "Sentry", critical: false, pick: (h) => h?.sentry },
  { key: "pages", label: "Public pages", critical: false, pick: (h) => h?.pages },
];

export const HEALTH_CHECK_KEYS = HEALTH_CHECKS.map((c) => c.key);

function isDown(check, snapshot) {
  if (!snapshot) return false;
  if (check.key === "pages") return (snapshot.failing || 0) > 0;
  if (!snapshot.configured) return false;
  return check.critical ? Boolean(snapshot.error) || snapshot.connected === false : Boolean(snapshot.error);
}

/**
 * { overall: "ok" | "degraded" | "critical", failing: [keys that count],
 *   mutedFailing: [muted keys that are down anyway] }
 */
export function gradeHealth(health, muted = []) {
  const mutedSet = new Set(muted || []);
  const failing = [];
  const mutedFailing = [];
  let overall = "ok";
  for (const check of HEALTH_CHECKS) {
    if (!isDown(check, check.pick(health))) continue;
    if (mutedSet.has(check.key)) {
      mutedFailing.push(check.key);
      continue;
    }
    failing.push(check.key);
    if (check.critical) overall = "critical";
    else if (overall === "ok") overall = "degraded";
  }
  return { overall, failing, mutedFailing };
}

export const OVERALL_LABEL = {
  ok: "All systems operational",
  degraded: "Degraded - see details below",
  critical: "Critical - core dependency down",
};
