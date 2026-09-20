// The strict firewall policy: turns the existing signature-based threat
// scoring (threat-score.js) - previously a triage aid a human had to act
// on manually from the admin Pentester page - into automatic enforcement,
// plus an email alert so an attack doesn't just sit unnoticed in a table
// until someone happens to open the admin panel.
//
// Called from /api/internal/edge-log on every request (proxy.ts calls that
// route before deciding whether to bounce the request to /rate-limited),
// so a sufficiently severe first request from a brand-new IP is blocked
// immediately, not just on the IP's next attempt.

import { scoreRequest } from "./threat-score";
import { getRedis } from "@/lib/redis";
import { sendFirewallAlert } from "./alert-email";

// Auto-block threshold. threat-score.js's high-confidence signals
// (path-traversal, sql-injection-probe, xss-probe: 30-35 points each) match
// on specific, low-false-positive patterns - "../" sequences, "union...
// select", "<script" - that essentially never appear in a legitimate
// request path, so a single match is already strong evidence, not
// ambiguous noise. Set at 30 (rather than the 70 "critical" bucket the
// admin UI uses for display) so a strict policy actually blocks on one
// clear signal instead of waiting for two to stack.
const BLOCK_THRESHOLD = Number(process.env.FIREWALL_BLOCK_THRESHOLD) || 30;

// Lower-confidence signals alone (sensitive-path-probe, scanner-ua: 20
// points each - a crawler hitting /.git, or a UA that merely mentions a
// scanner tool) get a human's attention without blocking, since either can
// occasionally come from legitimate monitoring or authorized testing.
const ALERT_THRESHOLD = Number(process.env.FIREWALL_ALERT_THRESHOLD) || 20;

// One flagged-but-not-blocked email per IP per hour, so a slow scan or a
// noisy scanner doesn't produce dozens of emails for the same source.
const FLAG_ALERT_COOLDOWN_SECONDS = 60 * 60;

// Read by the admin Security page (via /api/admin/traffic) so the policy
// in effect is visible, not just a silent backend behaviour change.
export function getFirewallPolicy() {
  return {
    blockThreshold: BLOCK_THRESHOLD,
    alertThreshold: ALERT_THRESHOLD,
    alertEmailConfigured: Boolean(process.env.SECURITY_ALERT_EMAIL && process.env.RESEND_API_KEY),
  };
}

/**
 * Scores one request and, per the thresholds above, either auto-blocks the
 * IP (inserting into blocked_ips exactly like a manual admin block does,
 * tagged created_by: "firewall") or emails a lower-confidence "worth a
 * look" alert. Never throws - a bug here must never break request logging
 * or block a legitimate visitor over an internal error.
 *
 * @returns {Promise<boolean>} true if this request (and every subsequent
 *   one from the same IP, until an admin unblocks it) should be denied.
 */
export async function enforceFirewallPolicy({
  supabase,
  ip,
  path,
  method,
  userAgent,
  country,
  city,
  alreadyBlocked,
}) {
  if (alreadyBlocked || !ip || ip === "unknown") return Boolean(alreadyBlocked);

  try {
    const threat = scoreRequest({ path, user_agent: userAgent, method, blocked: false });
    if (threat.score < ALERT_THRESHOLD) return false;

    if (threat.score >= BLOCK_THRESHOLD) {
      // Re-check rather than trusting the caller's alreadyBlocked=false:
      // closes the narrow race of two near-simultaneous requests from the
      // same brand-new attacking IP both trying to be "the" insert, so at
      // most one alert email goes out per newly-blocked IP.
      const { data: existing } = await supabase
        .from("blocked_ips")
        .select("ip")
        .eq("ip", ip)
        .maybeSingle();

      if (existing) return true;

      const { error } = await supabase.from("blocked_ips").insert({
        ip,
        reason: `Auto-blocked by firewall policy (score ${threat.score}): ${threat.signals.join(", ")}`,
        created_by: "firewall",
      });

      if (error) {
        // Lost the insert race to a concurrent request under the unique
        // constraint on ip - it's still blocked either way.
        console.error("[firewall] Failed to auto-block", ip, error.message);
        return true;
      }

      sendFirewallAlert({
        outcome: "blocked",
        ip,
        path,
        method,
        country,
        city,
        userAgent,
        score: threat.score,
        signals: threat.signals,
      }).catch(() => {});

      return true;
    }

    // Flagged but under the block threshold.
    const redisPromise = getRedis();
    if (redisPromise) {
      const redis = await redisPromise;
      const isNew = await redis.set(`helixon:firewall-flag:${ip}`, "1", {
        NX: true,
        EX: FLAG_ALERT_COOLDOWN_SECONDS,
      });
      if (isNew === "OK") {
        sendFirewallAlert({
          outcome: "flagged",
          ip,
          path,
          method,
          country,
          city,
          userAgent,
          score: threat.score,
          signals: threat.signals,
        }).catch(() => {});
      }
    }

    return false;
  } catch (err) {
    console.error("[firewall] enforceFirewallPolicy error:", err.message);
    return Boolean(alreadyBlocked);
  }
}
