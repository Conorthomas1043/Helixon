import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { getClientIp } from "@/lib/ratelimit";
import { cleanLine } from "@/lib/sanitize";
import { getFirewallPolicy } from "@/lib/security/firewall";
import { blockIsActive } from "@/lib/security/rules";
import { scoreRequest } from "@/lib/security/threat-score";
import { alertRecipients, getSiteSettings } from "@/lib/site-settings";
import { RANGE_HOURS, rangeHours, decodePlace, geoPointFromRow, aggregateTrafficRows } from "@/lib/admin-traffic";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/*
 * Basic IP validation.
 *
 * This is deliberately validation-only. We do not trust the client for
 * geolocation; the IP comes from request_logs, and this helper only prevents
 * obviously malformed values being sent to the geolocation provider.
 *
 * Uses Node's built-in isIP() rather than a hand-rolled regex, since a
 * regex that doesn't account for "::" compression rejects almost every
 * real-world IPv6 address (including things like "::1" and
 * "2001:db8::1").
 */
function isValidIp(ip) {
  if (!ip || typeof ip !== "string") {
    return false;
  }

  return isIP(ip.trim()) !== 0;
}

function isPrivateOrReservedIp(ip) {
  if (!ip) {
    return true;
  }

  const value = ip.trim();

  // IPv4 private/reserved ranges.
  if (
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    value.startsWith("127.") ||
    value.startsWith("169.254.")
  ) {
    return true;
  }

  const parts = value.split(".");

  if (parts.length === 4) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);

    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    if (a === 100 && b >= 64 && b <= 127) {
      // CGNAT 100.64.0.0/10
      return true;
    }

    if (a >= 224) {
      // Multicast/reserved.
      return true;
    }
  }

  // IPv6 local/reserved ranges.
  const lower = value.toLowerCase();

  if (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. "::ffff:192.168.1.1") - re-check the embedded
  // IPv4 address against the private ranges above instead of letting it
  // slip through as "public" just because it's wrapped in IPv6 syntax.
  if (lower.startsWith("::ffff:")) {
    const embedded = value.slice(7);
    if (isIP(embedded) === 4) {
      return isPrivateOrReservedIp(embedded);
    }
  }

  return false;
}

// Rows returned for the request log table. The map and totals don't come
// from these - they're aggregated over the whole range in the database.
const LOG_LIMIT = 2000;
// The log list: everything but the heavy detail (headers, bodies), which
// the inspector fetches per request.
const LOG_COLUMNS = "id,ip,user_agent,method,path,query,host,country,city,lat,lon,referer,blocked,ts,outcome,status_code,location,rule,threat_score,signals";
const LOG_COLUMNS_BASIC = "id,ip,user_agent,method,path,country,city,lat,lon,referer,blocked,ts";
const OUTCOMES = new Set(["allowed", "blocked", "redirected", "not_found"]);
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const url = new URL(request.url);

    const range = RANGE_HOURS[url.searchParams.get("range")] ? url.searchParams.get("range") : "24h";
    const since = new Date(Date.now() - rangeHours(range) * 60 * 60 * 1000).toISOString();

    // Optional request-log filters (the map's "show requests from here",
    // and the log's own filter controls). All values go in as data (eq /
    // ilike with LIKE wildcards escaped), never as filter syntax.
    const country = cleanLine(url.searchParams.get("country"), 8)?.toUpperCase() || null;
    const ipFilter = cleanLine(url.searchParams.get("ip"), 64) || null;
    const onlyBlocked = url.searchParams.get("blocked") === "1";
    const outcome = OUTCOMES.has(url.searchParams.get("outcome")) ? url.searchParams.get("outcome") : null;
    const flagged = url.searchParams.get("flagged") === "1";
    const methodFilter = METHODS.has(String(url.searchParams.get("method") || "").toUpperCase()) ? url.searchParams.get("method").toUpperCase() : null;
    const pathFilter = cleanLine(url.searchParams.get("path"), 200) || null;
    const uaFilter = cleanLine(url.searchParams.get("ua"), 120) || null;
    const time = (name) => (Number.isFinite(Date.parse(url.searchParams.get(name) || "")) ? new Date(url.searchParams.get(name)).toISOString() : null);
    // Keyset paging for "load older": everything strictly before this time.
    const before = time("before");
    // A slice of the range (a bar clicked on the timeline): from <= ts < to.
    const from = time("from");
    const to = time("to");
    const lower = from && from > since ? from : since;
    const upper = [before, to].filter(Boolean).sort()[0] || null;
    const like = (value) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

    const buildLog = (columns) => {
      let query = supabase.from("request_logs").select(columns).gte("ts", lower).order("ts", { ascending: false }).limit(LOG_LIMIT);
      if (upper) query = query.lt("ts", upper);
      if (country) query = query.eq("country", country);
      if (ipFilter && isValidIp(ipFilter)) query = query.eq("ip", ipFilter.trim());
      if (onlyBlocked) query = query.eq("blocked", true);
      if (methodFilter) query = query.eq("method", methodFilter);
      if (pathFilter) query = query.ilike("path", like(pathFilter));
      if (uaFilter) query = query.ilike("user_agent", like(uaFilter));
      // Rows logged before outcomes were recorded only know blocked or not.
      if (outcome === "blocked") query = query.eq("blocked", true);
      else if (outcome === "allowed") query = query.or("outcome.eq.allowed,and(outcome.is.null,blocked.is.false)");
      else if (outcome) query = query.eq("outcome", outcome);
      if (flagged) query = query.gte("threat_score", 20);
      return query;
    };
    let logQuery = buildLog(LOG_COLUMNS);

    const blockedQuery = (columns) => supabase.from("blocked_ips").select(columns).order("created_at", { ascending: false });
    let [requestLogsResult, blockedIpsResult, geoResult, summaryResult, settings, timelineResult, topIpsResult] = await Promise.all([
      logQuery,
      blockedQuery("ip,reason,created_at,created_by,expires_at"),
      supabase.rpc("admin_traffic_geo", { p_since: since }),
      supabase.rpc("admin_traffic_summary", { p_since: since }),
      getSiteSettings(),
      // Hourly up to a week, daily beyond.
      supabase.rpc("admin_traffic_timeline", { p_since: since, p_bucket: rangeHours(range) > 24 * 7 ? "day" : "hour" }),
      supabase.rpc("admin_top_ips", { p_since: since, p_limit: 15 }),
    ]);
    // expires_at arrives with migration 20260929030000.
    if (blockedIpsResult.error?.code === "42703") blockedIpsResult = await blockedQuery("ip,reason,created_at,created_by");
    // The inspector columns arrive with migration 20260929040000.
    if (requestLogsResult.error?.code === "42703") requestLogsResult = await buildLog(LOG_COLUMNS_BASIC);

    if (requestLogsResult.error) return adminDbError("traffic", requestLogsResult.error);
    if (blockedIpsResult.error) return adminDbError("traffic", blockedIpsResult.error);

    const rows = (requestLogsResult.data || []).map((row) => {
      const out = { ...row, city: decodePlace(row.city) };
      // Rows logged before scores were stored are scored the same way now.
      if (row.threat_score === null || row.threat_score === undefined) {
        const threat = scoreRequest(row);
        out.threat_score = threat.score;
        out.signals = threat.signals;
      }
      return out;
    });

    // Whole-range aggregates from the database. If the functions aren't
    // there (migration 20260929020000 not applied yet), fall back to
    // aggregating the rows we have - accurate for short ranges only, and
    // flagged as partial so the page can say so.
    let globe;
    let summary;
    let partial = false;
    if (!geoResult.error && !summaryResult.error) {
      globe = (geoResult.data || []).map(geoPointFromRow);
      const s = (summaryResult.data || [])[0] || {};
      summary = {
        requests: Number(s.requests || 0),
        blocked: Number(s.blocked || 0),
        uniqueIps: Number(s.unique_ips || 0),
        geolocated: Number(s.geolocated || 0),
        countries: Number(s.countries || 0),
      };
    } else {
      console.error("[admin/traffic] Aggregate functions unavailable, falling back:", geoResult.error?.message || summaryResult.error?.message);
      const agg = aggregateTrafficRows(rows);
      globe = agg.points;
      summary = agg.summary;
      partial = rows.length >= LOG_LIMIT;
    }

    return json({
      ok: true,
      admin: { username: admin.username },
      range,
      since,
      rows,
      logLimit: LOG_LIMIT,
      filters: { country, ip: ipFilter, blocked: onlyBlocked, outcome, flagged, method: methodFilter, path: pathFilter, ua: uaFilter, before, from, to },
      // Expired time-limited blocks no longer apply, so they aren't listed.
      blockedIps: (blockedIpsResult.data || []).filter((row) => blockIsActive(row)),
      cursor: rows.length === LOG_LIMIT ? rows[rows.length - 1].ts : null,
      timeline: timelineResult.error
        ? null
        : {
            bucket: rangeHours(range) > 24 * 7 ? "day" : "hour",
            points: (timelineResult.data || []).map((p) => ({ at: p.bucket, requests: Number(p.requests), blocked: Number(p.blocked), flagged: Number(p.flagged) })),
          },
      topIps: topIpsResult.error ? null : topIpsResult.data || [],
      capture: settings.traffic,
      globe,
      summary,
      partial,
      geolocation: {
        source: "vercel-edge-headers",
        resolvedIps: summary.geolocated,
        unresolvedIps: Math.max(0, summary.requests - summary.geolocated),
      },
      firewallPolicy: getFirewallPolicy(settings.firewall, alertRecipients(settings)),
    });
  } catch (error) {
    return adminErrorResponse("traffic", error);
  }
}

export async function POST(
  request,
) {
  try {
    const admin =
      await requireAdminSession();

    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }

    const supabase =
      getAdminSupabase();

    const body =
      (await request.json().catch(() => null)) ?? {};

    const ip =
      String(body.ip || "").trim();

    const reason =
      cleanLine(body.reason, 500) ||
      "Admin block";

    // Optional duration in hours (max 90 days); none = permanent.
    const hours = Number(body.hours);
    const expiresAt =
      Number.isFinite(hours) && hours > 0
        ? new Date(Date.now() + Math.min(hours, 24 * 90) * 3600e3).toISOString()
        : null;

    if (!isValidIp(ip)) {
      return json(
        {
          error:
            "A valid IP address is required.",
        },
        400,
      );
    }

    // Blocking makes proxy.ts bounce every request from that address to
    // /rate-limited. Refuse the two blocks that can only hurt: private/
    // reserved addresses (proxies and internal traffic - meaningless as a
    // block, and can knock out a whole office or the platform itself) and the
    // admin's own IP (an easy way to lock yourself out mid-incident).
    if (isPrivateOrReservedIp(ip)) {
      return json(
        {
          error:
            "That is a private or reserved address and can't be blocked.",
        },
        400,
      );
    }

    if (ip === getClientIp(request)) {
      return json(
        {
          error:
            "That is your own IP address - blocking it would lock you out.",
        },
        400,
      );
    }

    const { error } =
      await supabase
        .from("blocked_ips")
        .upsert(
          {
            ip,
            reason,
            created_by:
              admin.username,
            created_at: new Date().toISOString(),
            expires_at: expiresAt,
          },
          {
            onConflict: "ip",
          },
        );

    if (error) {
      return adminDbError("traffic", error);
    }

    await writeAdminAudit({
      adminUsername:
        admin.username,
      action: "block_ip",
      targetType: "ip",
      targetId: ip,
      metadata: {
        ip,
        reason,
        expiresAt,
      },
      request,
    });

    return json({
      ok: true,
      message: `${ip} blocked.`,
    });
  } catch (error) {
    return adminErrorResponse("traffic", error);
  }
}

export async function DELETE(
  request,
) {
  try {
    const admin =
      await requireAdminSession();

    if (!verifyCsrf(request)) {
      return json(CSRF_REJECTION, 403);
    }

    const supabase =
      getAdminSupabase();

    const body =
      (await request.json().catch(() => null)) ?? {};

    const ip =
      String(body.ip || "").trim();

    if (!isValidIp(ip)) {
      return json(
        {
          error:
            "A valid IP address is required.",
        },
        400,
      );
    }

    const { error } =
      await supabase
        .from("blocked_ips")
        .delete()
        .eq("ip", ip);

    if (error) {
      return adminDbError("traffic", error);
    }

    await writeAdminAudit({
      adminUsername:
        admin.username,
      action: "unblock_ip",
      targetType: "ip",
      targetId: ip,
      metadata: {
        ip,
      },
      request,
    });

    return json({
      ok: true,
      message: `${ip} unblocked.`,
    });
  } catch (error) {
    return adminErrorResponse("traffic", error);
  }
}