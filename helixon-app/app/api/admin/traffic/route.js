import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAudit } from "@/lib/admin-audit";

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

  // IPv4-mapped IPv6 (e.g. "::ffff:192.168.1.1") — re-check the embedded
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

export async function GET(request) {
  try {
    const admin =
      await requireAdminSession();

    const supabase =
      getAdminSupabase();

    const url =
      new URL(request.url);

    const range =
      url.searchParams.get("range") ||
      "24h";

    const hours =
      range === "30d"
        ? 720
        : range === "7d"
          ? 168
          : 24;

    const since = new Date(
      Date.now() -
        hours * 60 * 60 * 1000,
    ).toISOString();

    const [
      requestLogsResult,
      blockedIpsResult,
    ] = await Promise.all([
      supabase
        .from("request_logs")
        .select(
          [
            "id",
            "ip",
            "user_agent",
            "method",
            "path",
            "country",
            "city",
            "lat",
            "lon",
            "referer",
            "blocked",
            "ts",
          ].join(","),
        )
        .gte("ts", since)
        .order("ts", {
          ascending: false,
        })
        .limit(5000),

      supabase
        .from("blocked_ips")
        .select(
          "ip,reason,created_at,created_by",
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (requestLogsResult.error) {
      return json(
        {
          error:
            requestLogsResult.error
              .message,
        },
        500,
      );
    }

    if (blockedIpsResult.error) {
      return json(
        {
          error:
            blockedIpsResult.error
              .message,
        },
        500,
      );
    }

    const rows =
      requestLogsResult.data || [];

    const blockedIps =
      blockedIpsResult.data || [];

    /*
     * Build geographic points from lat/lon captured at request time
     * (proxy.ts reads Vercel's x-vercel-ip-latitude/-longitude headers -
     * see app/api/internal/edge-log/route.js). No external geolocation
     * call, no rate limit, no added latency on this page load.
     *
     * Aggregate traffic at each geographic coordinate so the globe
     * doesn't render hundreds of duplicate points for the same source.
     * Coordinates are rounded to ~1km so IPs in the same city collapse
     * into one point instead of scattering into a cluster of near-
     * identical dots.
     */
    const globeMap = new Map();
    let resolvedCount = 0;
    let unresolvedCount = 0;

    for (const row of rows) {
      if (!row.ip) {
        continue;
      }

      const lat = Number(row.lat);
      const lon = Number(row.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        unresolvedCount += 1;
        continue;
      }

      resolvedCount += 1;

      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;

      const key = [
        row.country || "",
        row.city || "",
        roundedLat,
        roundedLon,
      ].join("|");

      const existing =
        globeMap.get(key) || {
          city: row.city || null,
          country: row.country || null,
          lat: roundedLat,
          lon: roundedLon,
          count: 0,
          blocked: 0,
          uniqueIps: new Set(),
        };

      existing.count += 1;
      existing.uniqueIps.add(row.ip);

      if (row.blocked) {
        existing.blocked += 1;
      }

      globeMap.set(key, existing);
    }

    const globe =
      Array.from(
        globeMap.values(),
      )
        .map((point) => ({
          ...point,
          uniqueIps:
            point.uniqueIps.size,
        }))
        .sort(
          (a, b) =>
            b.count - a.count,
        )
        .slice(0, 200);

    return json({
      ok: true,

      admin: {
        username:
          admin.username,
      },

      range,
      since,

      rows,

      blockedIps,

      /*
       * Real coordinates for the source IPs, captured for free by
       * Vercel at request time.
       */
      globe,

      geolocation: {
        source: "vercel-edge-headers",
        resolvedIps: resolvedCount,
        unresolvedIps: unresolvedCount,
      },
    });
  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          "Internal server error",
      },
      error?.message ===
        "Unauthorized"
        ? 401
        : 500,
    );
  }
}

export async function POST(
  request,
) {
  try {
    const admin =
      await requireAdminSession();

    const supabase =
      getAdminSupabase();

    const body =
      await request.json();

    const ip =
      String(body.ip || "").trim();

    const reason = String(
      body.reason ||
        "Admin block",
    )
      .trim()
      .slice(0, 500);

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
        .upsert(
          {
            ip,
            reason,
            created_by:
              admin.username,
          },
          {
            onConflict: "ip",
          },
        );

    if (error) {
      return json(
        {
          error: error.message,
        },
        500,
      );
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
      },
      request,
    });

    return json({
      ok: true,
      message: `${ip} blocked.`,
    });
  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          "Internal server error",
      },
      error?.message ===
        "Unauthorized"
        ? 401
        : 500,
    );
  }
}

export async function DELETE(
  request,
) {
  try {
    const admin =
      await requireAdminSession();

    const supabase =
      getAdminSupabase();

    const body =
      await request.json();

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
      return json(
        {
          error: error.message,
        },
        500,
      );
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
    return json(
      {
        error:
          error?.message ||
          "Internal server error",
      },
      error?.message ===
        "Unauthorized"
        ? 401
        : 500,
    );
  }
}