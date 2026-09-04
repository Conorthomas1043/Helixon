// app/api/internal/edge-log/route.js
// Called by proxy.ts on every request.
// - Inserts a row into request_logs
// - Returns { isBlocked: bool } so proxy.ts can gate the request
//
// Guarded by a shared-secret header (INTERNAL_EDGE_LOG_SECRET) that only
// proxy.ts knows, checked with a timing-safe comparison. Previously this
// route had no auth at all: it inserted caller-supplied ip/country/geo
// straight into request_logs, so anyone who found the URL could POST
// forged rows and poison the data every SEO/security/pentester admin page
// reads from. Set INTERNAL_EDGE_LOG_SECRET in the environment (any long
// random string) - proxy.ts sends the same value on every call. Fails
// closed: if the secret isn't set, or doesn't match, the request is
// rejected rather than silently trusted.

import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const INTERNAL_HEADER = "x-internal-secret";

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request) {
  try {
    const expected = process.env.INTERNAL_EDGE_LOG_SECRET;
    const provided = request.headers.get(INTERNAL_HEADER) || "";

    if (!expected) {
      console.error("[edge-log] INTERNAL_EDGE_LOG_SECRET is not set - rejecting all requests.");
      return Response.json({ ok: false, isBlocked: false }, { status: 503 });
    }

    if (!timingSafeEqualStr(expected, provided)) {
      return Response.json({ ok: false, isBlocked: false }, { status: 401 });
    }

    const body = await request.json();
    const { ip, ua, method, path, ts, referer, country, city, lat, lon } =
      body;

    const latitude = Number(lat);
    const longitude = Number(lon);

    const hasCoords =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    // Check if IP is blocked (fast single-row lookup)
    const { data: blockedRow } = await supabase
      .from("blocked_ips")
      .select("ip")
      .eq("ip", ip)
      .maybeSingle();

    const isBlocked = !!blockedRow;

    // Fire-and-forget log insert (we don't await errors; traffic logging
    // must never slow down or break real requests)
    supabase
      .from("request_logs")
      .insert({
        ip,
        user_agent: ua,
        method,
        path,
        country: country || null,
        city: city || null,
        lat: hasCoords ? latitude : null,
        lon: hasCoords ? longitude : null,
        referer: referer || null,
        blocked: isBlocked,
        ts: ts || new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {});

    return Response.json({ ok: true, isBlocked });
  } catch (err) {
    // Never let logging errors surface to callers
    return Response.json({ ok: true, isBlocked: false });
  }
}