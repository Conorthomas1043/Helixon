import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

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
        .select("id,status,plan"),

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
      return json(
        {
          error: failed.error.message,
        },
        500
      );
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

    const subscriptions = subscriptionsResult.data || [];

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
      },

      traffic: {
        series: Object.entries(hourly)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([timestamp, count]) => ({
            timestamp,
            count,
          })),

        topPaths: topEntries(pathCounts),
        countries: topEntries(countryCounts),
        referrers: topEntries(referrerCounts),
        userAgents: topEntries(userAgentCounts),
      },
    });
  } catch (error) {
    const status =
      error?.message === "Unauthorized" ? 401 : 500;

    return json(
      {
        error:
          error?.message || "Internal server error",
      },
      status
    );
  }
}