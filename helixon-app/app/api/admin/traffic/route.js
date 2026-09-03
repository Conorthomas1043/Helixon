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

/*
 * Module-local cache.
 *
 * This prevents repeated IP lookups during the lifetime of the server
 * instance. On serverless platforms the cache is intentionally treated as
 * best-effort; it is not relied upon for correctness.
 */
const geoCache = new Map();

const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

async function geolocateIp(ip) {
  if (!isValidIp(ip) || isPrivateOrReservedIp(ip)) {
    return null;
  }

  const cached = geoCache.get(ip);

  if (
    cached &&
    Date.now() - cached.timestamp < GEO_CACHE_TTL_MS
  ) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Helixon-SOC/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const latitude = Number(data?.latitude);
    const longitude = Number(data?.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    const result = {
      ip,
      city: data?.city || null,
      country: data?.country_name || data?.country || null,
      countryCode:
        data?.country_code || null,
      region: data?.region || null,
      lat: latitude,
      lon: longitude,
      asn: data?.asn || null,
      org: data?.org || null,
    };

    geoCache.set(ip, {
      timestamp: Date.now(),
      data: result,
    });

    return result;
  } catch {
    return null;
  }
}

/*
 * Geolocate unique IPs with bounded concurrency.
 *
 * We do not fire thousands of simultaneous requests at the geolocation
 * provider when the admin opens the Traffic page.
 */
async function geolocateIps(ips) {
  const uniqueIps = [
    ...new Set(
      ips
        .filter(Boolean)
        .map((ip) => String(ip).trim())
        .filter(isValidIp)
        .filter(
          (ip) => !isPrivateOrReservedIp(ip),
        ),
    ),
  ].slice(0, 200);

  const results = [];
  const concurrency = 8;

  for (
    let index = 0;
    index < uniqueIps.length;
    index += concurrency
  ) {
    const batch = uniqueIps.slice(
      index,
      index + concurrency,
    );

    const batchResults =
      await Promise.all(
        batch.map(geolocateIp),
      );

    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
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
     * Build real geographic points from
     * the request source IPs.
     */
    const ips = rows
      .map((row) => row.ip)
      .filter(Boolean);

    const geolocations =
      await geolocateIps(ips);

    const geoByIp = new Map(
      geolocations.map(
        (location) => [
          location.ip,
          location,
        ],
      ),
    );

    /*
     * Aggregate traffic at each geographic
     * coordinate so the globe doesn't render
     * hundreds of duplicate points for the same
     * source.
     */
    const globeMap = new Map();

    for (const row of rows) {
      if (!row.ip) {
        continue;
      }

      const location =
        geoByIp.get(row.ip);

      if (!location) {
        continue;
      }

      const key = [
        location.countryCode ||
          location.country ||
          "",
        location.city || "",
        location.lat,
        location.lon,
      ].join("|");

      const existing =
        globeMap.get(key) || {
          city: location.city,
          country: location.country,
          countryCode:
            location.countryCode,
          region: location.region,
          lat: location.lat,
          lon: location.lon,
          count: 0,
          blocked: 0,
          uniqueIps: new Set(),
        };

      existing.count += 1;
      existing.uniqueIps.add(
        row.ip,
      );

      if (row.blocked) {
        existing.blocked += 1;
      }

      globeMap.set(
        key,
        existing,
      );
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
       * These are genuine coordinates returned
       * for the source public IPs.
       */
      globe,

      geolocation: {
        provider: "ipapi.co",
        resolvedIps:
          geolocations.length,
        unresolvedIps:
          Math.max(
            0,
            new Set(
              ips,
            ).size -
              geolocations.length,
          ),
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