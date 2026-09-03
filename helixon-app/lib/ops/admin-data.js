import { createClient } from "@supabase/supabase-js";
import { scoreRequest } from "../security/threat-score";
import { classifyAcquisition, groupBy } from "./attribution";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function rows(client, table, limit = 1000, order = "created_at") {
  const result = await client.from(table).select("*").order(order, { ascending: false }).limit(limit);
  if (result.error) return [];
  return result.data || [];
}

function sumNumeric(rows, keys) {
  return rows.reduce((sum, row) => {
    for (const key of keys) {
      const n = Number(row?.[key]);
      if (Number.isFinite(n)) return sum + n;
    }
    return sum;
  }, 0);
}

export async function getAdminOpsData() {
  const client = adminClient();
  const [requests, logins, authLogins, mfa, audit, demos, agencies, trials, subscriptions, users, employees, candidates, jobs, analyses] = await Promise.all([
    rows(client, "request_logs", 1200),
    rows(client, "login_attempts", 600),
    rows(client, "auth_login_attempts", 600),
    rows(client, "mfa_attempts", 600),
    rows(client, "admin_audit_logs", 600),
    rows(client, "demo_requests", 600),
    rows(client, "agencies", 1000),
    rows(client, "trial_verifications", 600),
    rows(client, "subscriptions", 1000),
    rows(client, "users", 1000),
    rows(client, "employees", 500),
    rows(client, "candidates", 1000),
    rows(client, "jobs", 1000),
    rows(client, "analyses", 1000),
  ]);

  const scoredRequests = requests.map((row) => ({
    ...row,
    threat: scoreRequest(row),
  }));

  const threats = scoredRequests.filter((row) => row.threat.score >= 20).sort((a, b) => b.threat.score - a.threat.score);
  const ipMap = new Map();
  for (const row of scoredRequests) {
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
      requests: requests.length,
      blockedRequests: requests.filter((x) => !!x.blocked).length,
      threats: threats.length,
      failedLogins: [...logins, ...authLogins].filter((x) => /fail|invalid|denied|false/i.test(`${x.status || ""} ${x.success ?? ""}`)).length,
      mfaFailures: mfa.filter((x) => /fail|denied|false/i.test(`${x.status || ""} ${x.success ?? ""}`)).length,
      auditEvents: audit.length,
    },
    requests: scoredRequests.slice(0, 250),
    threats: threats.slice(0, 100),
    ipInvestigations,
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
