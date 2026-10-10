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

import "server-only";
import { scoreRequest } from "./threat-score";
import { getRedis } from "@/lib/redis";
import { sendFirewallAlert } from "./alert-email";
import { reportError, reportQuietly } from "@/lib/report-error";

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

// Automatic blocks lift after a day unless an admin chooses otherwise, so a
// mistaken one doesn't lock someone out until a person notices.
const DEFAULT_BLOCK_HOURS = 24;

// One flagged-but-not-blocked email per IP per hour, so a slow scan or a
// noisy scanner doesn't produce dozens of emails for the same source.
const FLAG_ALERT_COOLDOWN_SECONDS = 60 * 60;

// The thresholds above are the defaults; an admin can change them (and
// switch auto-blocking or alert emails off, or make auto-blocks expire) on
// the Security page, stored as the "firewall" site setting. `policy` is
// that setting; without it the defaults apply.
function resolvePolicy(policy) {
  return {
    blockThreshold: Number(policy?.blockThreshold) || BLOCK_THRESHOLD,
    alertThreshold: Number(policy?.alertThreshold) || ALERT_THRESHOLD,
    autoBlock: policy?.autoBlock !== false,
    // Unset = DEFAULT_BLOCK_HOURS; an explicit 0 (an admin's choice on the
    // Security page) means permanent.
    autoBlockHours: policy?.autoBlockHours == null ? DEFAULT_BLOCK_HOURS : Number(policy.autoBlockHours) || 0,
    emailAlerts: policy?.emailAlerts !== false,
    // Query strings carry free-text searches (admins' included), so by
    // default attacks found there are recorded and flagged but don't
    // auto-block; an admin can opt in on the Security page.
    blockOnQuery: policy?.blockOnQuery === true,
  };
}

// Read by the admin Security page (via /api/admin/traffic) so the policy
// in effect is visible, not just a silent backend behaviour change.
export function getFirewallPolicy(policy, recipients = null) {
  return {
    ...resolvePolicy(policy),
    alertEmailConfigured: Boolean((recipients?.length || process.env.SECURITY_ALERT_EMAIL) && process.env.RESEND_API_KEY),
  };
}

/**
 * Scores one request and, per the thresholds above, either auto-blocks the
 * IP (inserting into blocked_ips exactly like a manual admin block does,
 * tagged created_by: "firewall") or emails a lower-confidence "worth a
 * look" alert. Never throws - a bug here must never break request logging
 * or block a legitimate visitor over an internal error.
 *
 * @returns {Promise<boolean>} true if this request should be denied (and,
 *   when the IP was blocked, every later one until the block lifts).
 */
export async function enforceFirewallPolicy({
  supabase,
  ip,
  path,
  method,
  userAgent,
  country,
  city,
  fetchSite,
  alreadyBlocked,
  policy,
  alertTo,
  query = "",
}) {
  if (alreadyBlocked || !ip || ip === "unknown") return Boolean(alreadyBlocked);
  const { blockThreshold, alertThreshold, autoBlock, autoBlockHours, emailAlerts, blockOnQuery } = resolvePolicy(policy);

  try {
    const threat = scoreRequest({ path, query: blockOnQuery ? query : "", user_agent: userAgent, method, blocked: false });
    if (threat.score < alertThreshold) return false;

    // Never put an IP on the block list over a request a browser sent. A
    // link can make anyone's browser request a hostile-looking path: an
    // <img> on another site (Sec-Fetch-Site: cross-site), a link clicked in
    // Outlook, Slack or a PDF, or pasted into the address bar ("none"), or
    // one inside a candidate's notes in the dashboard itself
    // ("same-origin"). Blocking on those let one crafted URL lock a
    // customer - or a whole office behind one NAT - out of the site. Every
    // browser sends Sec-Fetch-Site, and a page can't remove it, so such a
    // request is refused on its own and flagged for a human. Scanners and
    // scripts (curl, sqlmap...) send no header and are still blocked.
    const fromBrowser = Boolean(fetchSite);

    if (autoBlock && threat.score >= blockThreshold && !fromBrowser) {
      // Re-check rather than trusting the caller's alreadyBlocked=false:
      // closes the narrow race of two near-simultaneous requests from the
      // same brand-new attacking IP both trying to be "the" insert, so at
      // most one alert email goes out per newly-blocked IP. An expired
      // block left in the table is replaced, not treated as a live one.
      const { data: existing } = await supabase
        .from("blocked_ips")
        .select("ip,expires_at")
        .eq("ip", ip)
        .maybeSingle();

      if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) return true;

      const row = {
        ip,
        reason: `Auto-blocked by firewall policy (score ${threat.score}): ${threat.signals.join(", ")}`,
        created_by: "firewall",
        created_at: new Date().toISOString(),
      };
      if (autoBlockHours) row.expires_at = new Date(Date.now() + autoBlockHours * 3600e3).toISOString();
      else if (existing) row.expires_at = null;

      const { error } = existing
        ? await supabase.from("blocked_ips").update(row).eq("ip", ip)
        : await supabase.from("blocked_ips").insert(row);

      if (error) {
        // Lost the insert race to a concurrent request under the unique
        // constraint on ip - it's still blocked either way.
        reportError("[firewall] Failed to auto-block", ip, error.message);
        return true;
      }

      if (emailAlerts) sendFirewallAlert({
        to: alertTo,
        outcome: "blocked",
        ip,
        path,
        method,
        country,
        city,
        userAgent,
        score: threat.score,
        signals: threat.signals,
      }).catch(reportQuietly);

      return true;
    }

    // Flagged but under the block threshold (or auto-blocking is off).
    const redisPromise = emailAlerts ? getRedis() : null;
    if (redisPromise) {
      const redis = await redisPromise;
      const isNew = await redis.set(`helixon:firewall-flag:${ip}`, "1", {
        NX: true,
        EX: FLAG_ALERT_COOLDOWN_SECONDS,
      });
      if (isNew === "OK") {
        sendFirewallAlert({
          to: alertTo,
          outcome: "flagged",
          ip,
          path,
          method,
          country,
          city,
          userAgent,
          score: threat.score,
          signals: threat.signals,
        }).catch(reportQuietly);
      }
    }

    return fromBrowser && threat.score >= blockThreshold;
  } catch (err) {
    reportError("[firewall] enforceFirewallPolicy error:", err.message);
    return Boolean(alreadyBlocked);
  }
}
