// app/api/internal/edge-log/route.js
// Called by middleware.js on every request.
// - Inserts a row into request_logs
// - Returns { isBlocked: bool } so middleware can gate the request
//
// This route intentionally has NO auth guard - it's called by our own
// middleware. It is protected from external abuse because:
//   a) It only INSERTs/SELECTs and never exposes sensitive data in its response
//   b) You can add Vercel's trusted-IP header check here if needed

import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
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