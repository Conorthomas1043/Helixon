import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminErrorResponse, adminDbError } from "@/lib/admin-http";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();

    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "7d";

    const hours =
      range === "24h"
        ? 24
        : range === "30d"
          ? 24 * 30
          : range === "90d"
            ? 24 * 90
            : 24 * 7;

    const since = new Date(
      Date.now() - hours * 60 * 60 * 1000
    ).toISOString();

    const [
      agenciesResult,
      profilesResult,
      candidatesResult,
      jobsResult,
      analysesResult,
      demoResult,
      subscriptionsResult,
      requestCountResult,
      requestRowsResult,
      loginAttemptsResult,
      failedAuthResult,
      employeesResult,
    ] = await Promise.all([
      supabase
        .from("agencies")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("analyses")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("demo_requests")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("subscriptions")
        .select("id,status,plan,stripe_subscription_id"),

      supabase
        .from("request_logs")
        .select("id", {
          count: "exact",
          head: true,
        })
        .gte("ts", since),

      supabase
        .from("request_logs")
        .select(
          "id,ip,user_agent,method,path,country,city,referer,blocked,ts"
        )
        .gte("ts", since)
        .order("ts", {
          ascending: false,
        })
        .limit(5000),

      supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .gte("ts", since),

      supabase
        .from("auth_login_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("success", false)
        .gte("created_at", since),

      supabase
        .from("employees")
        .select("id", {
          count: "exact",
          head: true,
        }),
    ]);

    const results = [
      agenciesResult,
      profilesResult,
      candidatesResult,
      jobsResult,
      analysesResult,
      demoResult,
      subscriptionsResult,
      requestCountResult,
      requestRowsResult,
      loginAttemptsResult,
      failedAuthResult,
      employeesResult,
    ];

    const failed = results.find((result) => result.error);

    if (failed) {
      return adminDbError("stats", failed.error);
    }

    const trafficRows = requestRowsResult.data || [];

    const pathCounts = {};
    const countryCounts = {};
    const referrerCounts = {};
    const userAgentCounts = {};

    let blocked = 0;

    for (const row of trafficRows) {
      pathCounts[row.path || "(unknown)"] =
        (pathCounts[row.path || "(unknown)"] || 0) + 1;

      countryCounts[row.country || "(unknown)"] =
        (countryCounts[row.country || "(unknown)"] || 0) +
        1;

      referrerCounts[row.referer || "(direct)"] =
        (referrerCounts[row.referer || "(direct)"] ||
          0) + 1;

      userAgentCounts[
        row.user_agent || "(unknown)"
      ] =
        (userAgentCounts[row.user_agent || "(unknown)"] ||
          0) + 1;

      if (row.blocked) blocked++;
    }

    function topEntries(map, limit = 10) {
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({
          name,
          count,
        }));
    }

    // Demo access granted from the Users page is a subscriptions row with
    // no Stripe subscription - not revenue, so not counted here.
    const allSubscriptions = subscriptionsResult.data || [];
    const subscriptions = allSubscriptions.filter((sub) => sub.stripe_subscription_id);
    const demoSubscriptions = allSubscriptions.length - subscriptions.length;

    const subscriptionByStatus = {};
    const subscriptionByPlan = {};

    for (const sub of subscriptions) {
      subscriptionByStatus[sub.status || "unknown"] =
        (subscriptionByStatus[sub.status || "unknown"] ||
          0) + 1;

      subscriptionByPlan[sub.plan || "unknown"] =
        (subscriptionByPlan[sub.plan || "unknown"] ||
          0) + 1;
    }

    const hourly = {};

    for (const row of trafficRows) {
      const date = new Date(row.ts);

      const key =
        range === "24h"
          ? date.toISOString().slice(0, 13) + ":00:00Z"
          : date.toISOString().slice(0, 10);

      hourly[key] = (hourly[key] || 0) + 1;
    }

    // Whole-range numbers from the database (migration 20261001100000);
    // the newest-5,000-rows sample above is only the fallback. Lists are
    // about people - uptime checks and bots would otherwise top them - and
    // leave out the admin area.
    let series = Object.entries(hourly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, count]) => ({ timestamp, count }));
    let lists = {
      topPaths: topEntries(pathCounts),
      countries: topEntries(countryCounts),
      referrers: topEntries(referrerCounts),
      userAgents: topEntries(userAgentCounts),
    };
    let sampled = trafficRows.length >= 5000;
    const people = { audience: "people" };
    const [sumRes, lineRes, ...topRes] = await Promise.all([
      supabase.rpc("admin_traffic_summary_f", { p_since: since, p_until: null, p_filters: {} }),
      supabase.rpc("admin_traffic_timeline_f", { p_since: since, p_until: null, p_filters: {}, p_bucket: range === "24h" ? "hour" : "day" }),
      ...["path", "country", "referrer", "user_agent"].map((d) =>
        supabase.rpc("admin_traffic_top", { p_since: since, p_until: null, p_filters: people, p_dimension: d, p_limit: 10 })
      ),
    ]);
    if (!sumRes.error && !lineRes.error && topRes.every((r) => !r.error)) {
      blocked = Number(sumRes.data?.[0]?.blocked || 0);
      series = (lineRes.data || []).map((p) => ({ timestamp: new Date(p.bucket).toISOString(), count: Number(p.requests) }));
      const top = (r) => (r.data || []).map((x) => ({ name: x.name, count: Number(x.requests) }));
      lists = { topPaths: top(topRes[0]), countries: top(topRes[1]), referrers: top(topRes[2]), userAgents: top(topRes[3]) };
      sampled = false;
    }

    return json({
      admin: {
        username: admin.username,
      },

      range,
      since,

      totals: {
        agencies: agenciesResult.count || 0,
        users: profilesResult.count || 0,
        candidates: candidatesResult.count || 0,
        jobs: jobsResult.count || 0,
        analyses: analysesResult.count || 0,
        demoRequests: demoResult.count || 0,
        employees: employeesResult.count || 0,
        subscriptions: subscriptions.length,
        requests: requestCountResult.count || 0,
        loginAttempts:
          loginAttemptsResult.count || 0,
        failedAuthAttempts:
          failedAuthResult.count || 0,
        blockedRequests: blocked,
      },

      subscriptions: {
        byStatus: subscriptionByStatus,
        byPlan: subscriptionByPlan,
        demo: demoSubscriptions,
      },

      traffic: {
        series,
        ...lists,
        listsAbout: sampled ? "sample" : "people",
      },
    });
  } catch (error) {
    return adminErrorResponse("stats", error);
  }
}