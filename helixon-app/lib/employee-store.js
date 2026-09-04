// lib/employee-store.js
// Read-only stats snapshot shown on the employee dashboard.
//
// Previously this returned hardcoded numbers (totalUsers: 4213,
// activeToday: 318, uptimePct: 99.97, openTickets: 12) - none of it real.
// Now it's computed from request_logs and profiles, the same tables the
// admin stats route (app/api/admin/stats/route.js) reads from, just a
// narrower, lower-privilege slice safe for employee eyes: no IPs, no
// per-request detail, no revenue/subscription numbers.
//
// uptimePct and openTickets were dropped rather than kept as different
// fake numbers - there's no uptime monitor or support-ticket table backing
// either of them yet. Add them back for real once those exist.

import { supabase } from "@/lib/supabase";

// Paths that aren't a real person looking at the product - admin panel
// traffic, the internal logging endpoint itself, static assets - excluded
// so "site views today" reflects visitors, not staff/infra noise.
const EXCLUDED_PATH_PREFIXES = ["/admin", "/api", "/_next", "/favicon"];

function startOfTodayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function getStats() {
  const since = startOfTodayIso();

  const [{ count: totalUsers }, { data: rows, error }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("request_logs")
      .select("ip,path,blocked")
      .gte("ts", since)
      .limit(20000),
  ]);

  if (error) {
    console.error("[employee-store] getStats request_logs query failed:", error.message);
    return {
      totalUsers: totalUsers || 0,
      siteViewsToday: null,
      uniqueVisitorsToday: null,
      blockedToday: null,
    };
  }

  const siteRows = (rows || []).filter(
    (row) => !EXCLUDED_PATH_PREFIXES.some((prefix) => (row.path || "").startsWith(prefix)),
  );

  const uniqueIps = new Set(siteRows.map((row) => row.ip).filter(Boolean));
  const blockedToday = (rows || []).filter((row) => row.blocked).length;

  return {
    totalUsers: totalUsers || 0,
    siteViewsToday: siteRows.length,
    uniqueVisitorsToday: uniqueIps.size,
    blockedToday,
  };
}
