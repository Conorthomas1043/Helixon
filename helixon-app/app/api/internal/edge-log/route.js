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
    const { ip, ua, method, path, ts, referer, country, city } = body;

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