// lib/employee/store.js
// Read-only stats snapshot shown on the employee dashboard.
//
// Computed from request_logs and profiles, the same tables the admin stats
// route (app/api/admin/stats/route.js) reads from, just a narrower,
// lower-privilege slice safe for employee eyes: no IPs, no per-request
// detail, no revenue/subscription numbers.
//
// There's no uptime or open-tickets figure: no uptime monitor or
// support-ticket table backs either yet. Add them once those exist.

import "server-only";
import { supabase } from "@/lib/supabase";
import { reportError } from "@/lib/report-error";
import { fetchAll } from "@/lib/fetch-all";

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
    // A page at a time - one select stops at 1,000 rows, so every figure
    // topped out there on a busy day.
    fetchAll((from, to) => supabase.from("request_logs").select("id,ip,path,blocked").gte("ts", since).order("id").range(from, to), { cap: 20000 }),
  ]);

  if (error) {
    reportError("[employee-store] getStats request_logs query failed:", error.message);
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
