// Traffic spike alerts. The firewall already emails about individual
// attacking IPs; this watches the whole site: a surge in requests, a surge
// in blocked requests, a burst of server errors, or one address flooding
// the site. Checked at most every five minutes, from request logging
// (app/api/internal/edge-log) rather than a cron, so it works on any
// Vercel plan. Each kind alerts at most once an hour. Alerts are listed on
// admin Traffic and emailed to the Security page's alert recipients.

import "server-only";
import { supabase } from "@/lib/supabase";
import { escapeHtml, sendAdminAlert } from "@/lib/security/alert-email";
import { alertRecipients } from "@/lib/site-settings";

export const WINDOW_MINUTES = 15;
const CHECK_EVERY_SECONDS = 300;
const COOLDOWN_MS = 60 * 60 * 1000;
const ERROR_THRESHOLD = 20;
const BLOCKED_FLOOR = 50;

let lastLocalCheck = 0;

/**
 * What's worth an alert in `stats` (a row of admin_traffic_spike_stats).
 * Pure, so it's tested. Returns [{ kind, message, details }].
 */
export function spikeFindings(stats, settings = {}) {
  if (!stats) return [];
  const multiplier = settings.spikeMultiplier || 5;
  const minRequests = settings.spikeMinRequests || 300;
  const flood = settings.floodRequests || 300;
  const n = (v) => Number(v) || 0;
  const out = [];
  const requests = n(stats.recent_requests);
  const baseline = n(stats.baseline_requests);
  const requestLine = Math.max(minRequests, Math.ceil(baseline * multiplier));
  if (requests >= requestLine) {
    out.push({
      kind: "surge",
      message: `${requests.toLocaleString("en-GB")} requests in the last ${WINDOW_MINUTES} minutes - about ${baseline ? Math.round(requests / baseline) : "many"}× the usual ${Math.round(baseline)}.`,
      details: { requests, baseline: Math.round(baseline * 10) / 10, threshold: requestLine, topCountry: stats.top_country, topCountryRequests: n(stats.top_country_requests) },
    });
  }
  const blocked = n(stats.recent_blocked);
  const blockedLine = Math.max(BLOCKED_FLOOR, Math.ceil(n(stats.baseline_blocked) * multiplier));
  if (blocked >= blockedLine) {
    out.push({
      kind: "blocked_surge",
      message: `${blocked.toLocaleString("en-GB")} requests blocked in the last ${WINDOW_MINUTES} minutes (usually about ${Math.round(n(stats.baseline_blocked))}).`,
      details: { blocked, baseline: Math.round(n(stats.baseline_blocked) * 10) / 10, threshold: blockedLine },
    });
  }
  const errors = n(stats.recent_errors);
  if (errors >= ERROR_THRESHOLD) {
    out.push({ kind: "errors", message: `${errors} server errors (5xx) in the last ${WINDOW_MINUTES} minutes.`, details: { errors } });
  }
  const ipRequests = n(stats.top_ip_requests);
  if (stats.top_ip && ipRequests >= flood) {
    out.push({
      kind: "ip_flood",
      message: `${stats.top_ip} sent ${ipRequests.toLocaleString("en-GB")} requests in the last ${WINDOW_MINUTES} minutes.`,
      details: { ip: stats.top_ip, requests: ipRequests, threshold: flood },
    });
  }
  return out;
}

const SUBJECTS = {
  surge: "Traffic surge",
  blocked_surge: "Surge in blocked requests",
  errors: "Burst of server errors",
  ip_flood: "One address flooding the site",
};

// Called (in after()) on logged requests; does the real work at most once
// per CHECK_EVERY_SECONDS across every server. Never throws.
export async function maybeCheckTraffic(settings) {
  try {
    const traffic = settings?.traffic || {};
    if (traffic.spikeAlerts === false) return;
    const now = Date.now();
    if (now - lastLocalCheck < 60_000) return;
    lastLocalCheck = now;
    const { data: claimed, error: claimError } = await supabase.rpc("claim_traffic_check", { p_every_seconds: CHECK_EVERY_SECONDS });
    if (claimError || claimed !== true) return;

    const { data: rows, error } = await supabase.rpc("admin_traffic_spike_stats", { p_window_minutes: WINDOW_MINUTES });
    if (error) return;
    const findings = spikeFindings(rows?.[0], traffic);
    if (!findings.length) return;

    const { data: state } = await supabase.from("traffic_alert_state").select("last_alerts").eq("key", "spike").maybeSingle();
    const last = state?.last_alerts || {};
    const due = findings.filter((f) => !last[f.kind] || now - Date.parse(last[f.kind]) > COOLDOWN_MS);
    if (!due.length) return;

    const stamp = new Date(now).toISOString();
    await supabase
      .from("traffic_alert_state")
      .update({ last_alerts: { ...last, ...Object.fromEntries(due.map((f) => [f.kind, stamp])) } })
      .eq("key", "spike");

    const to = alertRecipients(settings);
    for (const f of due) {
      const emailed = await sendAdminAlert({
        to,
        subject: `Helixon: ${SUBJECTS[f.kind]}`,
        html: `<h2>${escapeHtml(SUBJECTS[f.kind])}</h2><p>${escapeHtml(f.message)}</p><p>Open Admin &gt; Traffic to see where it's coming from, and block addresses or countries from Security if it's an attack.</p>`,
      });
      await supabase.from("traffic_alerts").insert({ kind: f.kind, message: f.message, details: f.details, emailed: Boolean(emailed) });
    }
  } catch (err) {
    console.error("[traffic-alerts] Check failed:", err?.message);
  }
}
