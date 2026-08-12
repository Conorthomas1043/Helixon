// app/api/admin/traffic/route.js
// Returns aggregated traffic data for the admin Traffic tab.

import { supabase } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-auth";

function authCheck(request) {
  return getAdminSession().then((s) => {
    if (s) return s;
    const k = request.headers.get("x-admin-key");
    return k === process.env.ADMIN_KEY ? { username: "api-key" } : null;
  });
}

export async function GET(request) {
  const session = await authCheck(request);
  if (!session) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    // Default window: last 24 hours; supports ?hours=N up to 168 (7 days)
    const hours = Math.min(parseInt(searchParams.get("hours") || "24", 10), 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from("request_logs")
      .select("ip, method, path, country, city, user_agent, blocked, ts")
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const rows = logs || [];

    // ── Aggregations ──────────────────────────────────────────────────────────

    // Total requests
    const total = rows.length;
    const blocked = rows.filter((r) => r.blocked).length;

    // Requests per hour (bucket by hour for sparkline)
    const byHour = {};
    rows.forEach((r) => {
      const h = r.ts.slice(0, 13); // "2024-06-01T14"
      byHour[h] = (byHour[h] || 0) + 1;
    });
    // Fill in zeros for missing hours
    const hourBuckets = [];
    for (let i = hours - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 13);
      hourBuckets.push({ hour: key, count: byHour[key] || 0 });
    }

    // Top paths
    const pathCount = {};
    rows.forEach((r) => {
      const p = r.path.split("?")[0]; // strip query strings
      pathCount[p] = (pathCount[p] || 0) + 1;
    });
    const topPaths = Object.entries(pathCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, count]) => ({ path, count }));

    // Top IPs
    const ipCount = {};
    rows.forEach((r) => { ipCount[r.ip] = (ipCount[r.ip] || 0) + 1; });
    const topIPs = Object.entries(ipCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    // Country breakdown
    const countryCount = {};
    rows.forEach((r) => {
      const c = r.country || "Unknown";
      countryCount[c] = (countryCount[c] || 0) + 1;
    });
    const byCountry = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    // Method breakdown
    const methodCount = {};
    rows.forEach((r) => { methodCount[r.method] = (methodCount[r.method] || 0) + 1; });

    // API vs page requests
    const apiRequests = rows.filter((r) => r.path.startsWith("/api/")).length;
    const pageRequests = total - apiRequests;

    // Unique IPs / visitors
    const uniqueIPs = new Set(rows.map((r) => r.ip)).size;

    // Bot detection (simple UA heuristic)
    const botKeywords = ["bot", "crawler", "spider", "scraper", "python-requests", "curl", "wget", "httpclient"];
    const botRequests = rows.filter((r) =>
      botKeywords.some((k) => (r.user_agent || "").toLowerCase().includes(k))
    ).length;

    // Recent raw log (last 50 for the table)
    const recentLogs = rows.slice(0, 50).map((r) => ({
      ip: r.ip,
      method: r.method,
      path: r.path,
      country: r.country,
      blocked: r.blocked,
      ts: r.ts,
    }));

    return Response.json({
      ok: true,
      window: { hours, since },
      summary: {
        total,
        blocked,
        uniqueIPs,
        apiRequests,
        pageRequests,
        botRequests,
      },
      hourBuckets,
      topPaths,
      topIPs,
      byCountry,
      methodCount,
      recentLogs,
    });
  } catch (err) {
    console.error("TRAFFIC ERROR:", err.message); // ← added
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}