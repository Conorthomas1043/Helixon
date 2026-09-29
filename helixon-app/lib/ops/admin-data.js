import { createClient } from "@supabase/supabase-js";
import { scoreRequest } from "../security/threat-score";
import { classifyAcquisition, groupBy } from "./attribution";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function rows(client, table, limit = 1000, order = "created_at", since = null) {
  let query = client.from(table).select("*").order(order, { ascending: false }).limit(limit);
  if (since) query = query.gte(order, since);
  const result = await query;
  if (result.error) return [];
  return result.data || [];
}

async function countSince(client, table, column, from, to) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).gte(column, from).lt(column, to);
  return error ? null : count || 0;
}

export const OPS_RANGE_HOURS = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30, "90d": 24 * 90 };
// Requests scored per load. A range with more than this scores the newest.
const REQUEST_SAMPLE = 5000;

function sumNumeric(rows, keys) {
  return rows.reduce((sum, row) => {
    for (const key of keys) {
      const n = Number(row?.[key]);
      if (Number.isFinite(n)) return sum + n;
    }
    return sum;
  }, 0);
}

/**
 * `range` ("24h" | "7d" | "30d" | "90d") limits requests and demo requests
 * to that window and adds the previous window's totals for comparison.
 * Without it, the newest rows are used as before.
 */
export async function getAdminOpsData({ range = null } = {}) {
  const client = adminClient();
  const hours = OPS_RANGE_HOURS[range] || null;
  const now = Date.now();
  const since = hours ? new Date(now - hours * 3600e3).toISOString() : null;
  const prevSince = hours ? new Date(now - 2 * hours * 3600e3).toISOString() : null;
  const nowIso = new Date(now + 60e3).toISOString();
  const [requests, logins, authLogins, mfa, audit, demos, agencies, trials, subscriptions, users, employees, candidates, jobs, analyses, dismissals, prevRequests, prevDemos, rangeRequests] = await Promise.all([
    // request_logs and login_attempts use `ts`, not `created_at` - the
    // default. Ordering by a column that doesn't exist makes Postgres
    // error, which rows() silently swallows into [] - this made
    // scoreRequest() never run on real data, zeroing out threats,
    // ipInvestigations, and the request-derived slices of seo/kpis across
    // the Pentester, Investigate and SEO pages.
    rows(client, "request_logs", hours ? REQUEST_SAMPLE : 1200, "ts", since),
    rows(client, "login_attempts", 600, "ts"),
    rows(client, "auth_login_attempts", 600),
    rows(client, "mfa_attempts", 600),
    rows(client, "admin_audit_logs", 600),
    rows(client, "demo_requests", 600, "created_at", since),
    rows(client, "agencies", 1000),
    // trial_verifications has no created_at at all (only expires_at/used_at)
    // - same failure mode, silently zeroing sales.trials. expires_at is set
    // once at creation (now() + 24h), so ordering by it still orders by
    // recency.
    rows(client, "trial_verifications", 600, "expires_at"),
    rows(client, "subscriptions", 1000),
    rows(client, "users", 1000),
    rows(client, "employees", 500),
    rows(client, "candidates", 1000),
    rows(client, "jobs", 1000),
    rows(client, "analyses", 1000),
    // IPs an admin dismissed on Pentester (migration 20260929030000).
    rows(client, "threat_dismissals", 1000, "dismissed_at"),
    hours ? countSince(client, "request_logs", "ts", prevSince, since) : null,
    hours ? countSince(client, "demo_requests", "created_at", prevSince, since) : null,
    // Exact total for the window; `requests` itself is capped at REQUEST_SAMPLE.
    hours ? countSince(client, "request_logs", "ts", since, nowIso) : null,
  ]);
  const dismissedAt = new Map(dismissals.map((d) => [d.ip, { at: Date.parse(d.dismissed_at), by: d.dismissed_by, reason: d.reason }]));
  // A dismissal covers what the IP had done up to then; anything newer
  // shows up again.
  const isDismissed = (ip, ts) => {
    const d = dismissedAt.get(ip);
    return Boolean(d) && Date.parse(ts) <= d.at;
  };

  const scoredRequests = requests.map((row) => ({
    ...row,
    // request_logs' timestamp column is `ts`, not `created_at` like every
    // other table here - normalised once so the Pentester/Investigate
    // pages' existing `row.created_at` reads (matching the convention
    // every other table in this file follows) don't need special-casing.
    created_at: row.ts,
    threat: scoreRequest(row),
  }));

  const flagged = scoredRequests.filter((row) => row.threat.score >= 20);
  const threats = flagged.filter((row) => !isDismissed(row.ip, row.ts)).sort((a, b) => b.threat.score - a.threat.score);
  const dismissedThreats = flagged.length - threats.length;
  const ipMap = new Map();
  for (const row of scoredRequests) {
    if (row.threat.score >= 20 && isDismissed(row.ip, row.ts)) continue;
    const ip = row.ip || "unknown";
    const current = ipMap.get(ip) || { ip, requests: 0, blocked: 0, maxScore: 0, signals: new Set(), countries: new Set() };
    current.requests += 1;
    if (row.blocked) current.blocked += 1;
    current.maxScore = Math.max(current.maxScore, row.threat.score);
    row.threat.signals.forEach((s) => current.signals.add(s));
    if (row.country) current.countries.add(row.country);
    ipMap.set(ip, current);
  }
  const ipInvestigations = [...ipMap.values()].map((x) => ({ ...x, signals: [...x.signals], countries: [...x.countries] })).sort((a, b) => (b.maxScore - a.maxScore) || (b.requests - a.requests)).slice(0, 100);

  const acquisitionRows = [...demos, ...requests].map((row) => ({ ...row, channel: classifyAcquisition(row) }));
  const channels = groupBy(acquisitionRows, (x) => x.channel).map(([channel, count]) => ({ channel, count }));
  const campaigns = groupBy(demos, (x) => `${x.utm_source || "unknown"} / ${x.utm_medium || "unknown"} / ${x.utm_campaign || "none"}`).slice(0, 25).map(([campaign, count]) => ({ campaign, count }));
  const referrers = groupBy(requests.filter((x) => x.referer), (x) => x.referer).slice(0, 25).map(([referrer, count]) => ({ referrer, count }));
  const topPaths = groupBy(requests, (x) => x.path || "/").slice(0, 25).map(([path, count]) => ({ path, count }));
  const topCountries = groupBy(requests.filter((x) => x.country), (x) => x.country).slice(0, 25).map(([country, count]) => ({ country, count }));

  const activeSubscriptions = subscriptions.filter((x) => !x.status || /active|trialing/i.test(String(x.status)));
  const revenue = sumNumeric(activeSubscriptions, ["monthly_amount", "mrr", "amount_monthly", "price_monthly"]);

  return {
    kpis: {
      users: users.length,
      employees: employees.length,
      agencies: agencies.length,
      candidates: candidates.length,
      jobs: jobs.length,
      analyses: analyses.length,
      demos: demos.length,
      trials: trials.length,
      subscriptions: activeSubscriptions.length,
      mrr: revenue,
      requests: rangeRequests ?? requests.length,
      blockedRequests: requests.filter((x) => !!x.blocked).length,
      threats: threats.length,
      failedLogins: [...logins, ...authLogins].filter((x) => /fail|invalid|denied|false/i.test(`${x.status || ""} ${x.success ?? ""}`)).length,
      mfaFailures: mfa.filter((x) => /fail|denied|false/i.test(`${x.status || ""} ${x.success ?? ""}`)).length,
      auditEvents: audit.length,
    },
    requests: scoredRequests.slice(0, 250),
    threats: threats.slice(0, 100),
    ipInvestigations,
    range,
    since,
    sampled: hours ? requests.length >= REQUEST_SAMPLE : true,
    previous: hours ? { requests: prevRequests, demos: prevDemos } : null,
    dismissed: {
      requests: dismissedThreats,
      ips: [...dismissedAt.entries()].map(([ip, d]) => ({ ip, dismissedAt: new Date(d.at).toISOString(), by: d.by, reason: d.reason })),
    },
    audit: audit.slice(0, 100),
    seo: { channels, campaigns, referrers, topPaths, topCountries },
    sales: {
      leads: demos.length,
      trials: trials.length,
      agenciesByPlan: groupBy(agencies, (x) => x.plan_name || x.plan || "Unknown").map(([plan, count]) => ({ plan, count })),
      activeSubscriptions: activeSubscriptions.length,
      mrr: revenue,
      revenueSourceAvailable: activeSubscriptions.length > 0 && revenue > 0,
    },
    geo: {
      countries: topCountries,
    },
  };
}
