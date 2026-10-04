import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { getClientIp } from "@/lib/ratelimit";
import { cleanLine } from "@/lib/sanitize";
import { getFirewallPolicy } from "@/lib/security/firewall";
import { blockIsActive } from "@/lib/security/rules";
import { scoreRequest } from "@/lib/security/threat-score";
import { alertRecipients, getSiteSettings } from "@/lib/site-settings";
import { RANGE_HOURS, rangeHours, decodePlace, geoPointFromRow } from "@/lib/admin/traffic";

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

// Rows returned for the request log table, per page.
const LOG_LIMIT = 2000;
// The log list: everything but the heavy detail (headers, bodies), which
// the inspector fetches per request.
const LOG_COLUMNS = "id,ip,user_agent,method,path,query,host,country,city,lat,lon,referer,blocked,ts,outcome,status_code,location,rule,threat_score,signals,traffic_class";
const OUTCOMES = new Set(["allowed", "blocked", "redirected", "not_found"]);
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
// Who the numbers are about (lib/traffic-class.js). "people" also leaves
// out the admin area, so watching this page doesn't count as traffic.
const AUDIENCES = new Set(["all", "people", "automated", "crawler", "monitor", "bot"]);
// Whole-range breakdowns (admin_traffic_top).
const BREAKDOWNS = ["path", "referrer", "user_agent", "country", "class", "api", "not_found", "server_error"];
// 42883 / PGRST202: the function isn't there yet (migration not applied).

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const url = new URL(request.url);

    const range = RANGE_HOURS[url.searchParams.get("range")] ? url.searchParams.get("range") : "24h";
    const spanMs = rangeHours(range) * 60 * 60 * 1000;
    const since = new Date(Date.now() - spanMs).toISOString();
    const previousSince = new Date(Date.now() - 2 * spanMs).toISOString();

    // Request-log filters (the map's "show requests from here", the
    // panels' click-through and the log's own filter controls). All values
    // go in as data, never as filter syntax.
    const country = cleanLine(url.searchParams.get("country"), 8)?.toUpperCase() || null;
    const ipRaw = cleanLine(url.searchParams.get("ip"), 64) || null;
    const ipFilter = ipRaw && isValidIp(ipRaw) ? ipRaw.trim() : null;
    const onlyBlocked = url.searchParams.get("blocked") === "1";
    const outcome = OUTCOMES.has(url.searchParams.get("outcome")) ? url.searchParams.get("outcome") : onlyBlocked ? "blocked" : null;
    const flagged = url.searchParams.get("flagged") === "1";
    const methodFilter = METHODS.has(String(url.searchParams.get("method") || "").toUpperCase()) ? url.searchParams.get("method").toUpperCase() : null;
    const pathFilter = cleanLine(url.searchParams.get("path"), 200) || null;
    const uaFilter = cleanLine(url.searchParams.get("ua"), 120) || null;
    const referrerFilter = cleanLine(url.searchParams.get("referrer"), 200) || null;
    const audience = AUDIENCES.has(url.searchParams.get("audience")) ? url.searchParams.get("audience") : "all";
    const time = (name) => (Number.isFinite(Date.parse(url.searchParams.get(name) || "")) ? new Date(url.searchParams.get(name)).toISOString() : null);
    // Keyset paging for "load older": everything strictly before this time.
    const before = time("before");
    // A slice of the range (a bar clicked on the timeline): from <= ts < to.
    const from = time("from");
    const to = time("to");
    const lower = from && from > since ? from : since;
    const upper = [before, to].filter(Boolean).sort()[0] || null;

    const pFilters = {
      ...(country ? { country } : {}),
      ...(ipFilter ? { ip: ipFilter } : {}),
      ...(methodFilter ? { method: methodFilter } : {}),
      ...(pathFilter ? { path: pathFilter } : {}),
      ...(uaFilter ? { ua: uaFilter } : {}),
      ...(referrerFilter ? { referrer: referrerFilter } : {}),
      ...(outcome ? { outcome } : {}),
      ...(flagged ? { flagged: true } : {}),
      audience,
    };
    // The map shows every place (clicking one filters to it), and the
    // timeline the whole range (clicking a bar narrows to it).
    const { country: _country, ...mapFilters } = pFilters;
    const sliceUntil = to || null;
    const sliceSince = lower;

    const rpcLog = () =>
      supabase.rpc("admin_traffic_rows", { p_since: lower, p_until: upper, p_filters: pFilters }).select(LOG_COLUMNS).order("ts", { ascending: false }).limit(LOG_LIMIT);
    const bucket = rangeHours(range) > 24 * 7 ? "day" : "hour";
    const blockedQuery = (columns) => supabase.from("blocked_ips").select(columns).order("created_at", { ascending: false });

    const [logResult, blockedIpsResult, summaryResult, previousResult, geoResult, timelineResult, topIpsResult, settings, alertsResult, ...breakdownResults] = await Promise.all([
      rpcLog(),
      blockedQuery("ip,reason,created_at,created_by,expires_at"),
      supabase.rpc("admin_traffic_summary_f", { p_since: sliceSince, p_until: sliceUntil, p_filters: pFilters }),
      supabase.rpc("admin_traffic_summary_f", { p_since: previousSince, p_until: since, p_filters: pFilters }),
      supabase.rpc("admin_traffic_geo_f", { p_since: sliceSince, p_until: sliceUntil, p_filters: mapFilters }),
      supabase.rpc("admin_traffic_timeline_f", { p_since: since, p_until: null, p_filters: pFilters, p_bucket: bucket }),
      supabase.rpc("admin_top_ips_f", { p_since: sliceSince, p_until: sliceUntil, p_filters: pFilters, p_limit: 15 }),
      getSiteSettings(),
      supabase.from("traffic_alerts").select("id,kind,message,details,emailed,created_at").order("created_at", { ascending: false }).limit(20),
      ...BREAKDOWNS.map((dimension) =>
        supabase.rpc("admin_traffic_top", { p_since: sliceSince, p_until: sliceUntil, p_filters: pFilters, p_dimension: dimension, p_limit: 10 })
      ),
    ]);
    if (blockedIpsResult.error) return adminDbError("traffic", blockedIpsResult.error);

    if (logResult.error) return adminDbError("traffic", logResult.error);

    const rows = (logResult.data || []).map((row) => {
      const out = { ...row, city: decodePlace(row.city) };
      if (row.threat_score === null || row.threat_score === undefined) {
        const threat = scoreRequest(row);
        out.threat_score = threat.score;
        out.signals = threat.signals;
      }
      return out;
    });

    const shapeSummary = (res) => {
      const s = (res.data || [])[0];
      if (res.error || !s) return null;
      const n = (v) => Number(v || 0);
      return {
        requests: n(s.requests),
        blocked: n(s.blocked),
        flagged: n(s.flagged),
        uniqueIps: n(s.unique_ips),
        visitors: n(s.visitors),
        geolocated: n(s.geolocated),
        countries: n(s.countries),
        people: n(s.people),
        crawlers: n(s.crawlers),
        monitors: n(s.monitors),
        bots: n(s.bots),
        notFound: n(s.not_found),
        serverErrors: n(s.server_errors),
      };
    };
    const summary = shapeSummary(summaryResult) || { requests: 0, blocked: 0, flagged: 0, uniqueIps: 0, visitors: 0, geolocated: 0, countries: 0, people: 0, crawlers: 0, monitors: 0, bots: 0, notFound: 0, serverErrors: 0 };
    const breakdowns = Object.fromEntries(
      BREAKDOWNS.map((dimension, i) => [
        dimension,
        breakdownResults[i].error
          ? []
          : (breakdownResults[i].data || []).map((r) => ({ name: r.name, count: Number(r.requests), blocked: Number(r.blocked), errors: Number(r.errors) })),
      ])
    );

    return json({
      ok: true,
      admin: { username: admin.username },
      range,
      since,
      audience,
      rows,
      logLimit: LOG_LIMIT,
      filters: { country, ip: ipFilter, outcome, flagged, method: methodFilter, path: pathFilter, ua: uaFilter, referrer: referrerFilter, audience, before, from, to },
      blockedIps: (blockedIpsResult.data || []).filter((row) => blockIsActive(row)),
      cursor: rows.length === LOG_LIMIT ? rows[rows.length - 1].ts : null,
      timeline: timelineResult.error
        ? null
        : {
            bucket,
            points: (timelineResult.data || []).map((p) => ({ at: p.bucket, requests: Number(p.requests), blocked: Number(p.blocked), flagged: Number(p.flagged), people: Number(p.people) })),
          },
      topIps: topIpsResult.error ? null : topIpsResult.data || [],
      capture: settings.traffic,
      globe: geoResult.error ? [] : (geoResult.data || []).map(geoPointFromRow),
      summary,
      previous: shapeSummary(previousResult),
      breakdowns,
      alerts: alertsResult.error ? [] : alertsResult.data || [],
      partial: false,
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