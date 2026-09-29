// app/api/internal/edge-log/route.js
// Called by proxy.ts on every request.
// - Inserts a row into request_logs
// - Returns { isBlocked: bool, maintenance: bool } so proxy.ts can gate the
//   request (maintenance is the admin's switch on /admin/site, cached in
//   lib/site-settings.js)
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
import { enforceFirewallPolicy } from "@/lib/security/firewall";
import { alertRecipients, getSiteSettings } from "@/lib/site-settings";
import { blockIsActive, getFirewallRules, matchRequestRule } from "@/lib/security/rules";

// blocked_ips.expires_at arrives with migration 20260929030000; until then
// every block is permanent, as before.
async function findBlock(ip) {
  let result = await supabase.from("blocked_ips").select("ip,expires_at").eq("ip", ip).maybeSingle();
  if (result.error?.code === "42703") result = await supabase.from("blocked_ips").select("ip").eq("ip", ip).maybeSingle();
  return result.data || null;
}

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
    const { ip, ua, method, path, ts, referer, country, city, lat, lon, fetchSite } =
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

    // Check if IP is blocked (fast single-row lookup), and the site
    // settings and firewall rules (both in-memory cached) in parallel.
    const [blockedRow, settings, rules] = await Promise.all([findBlock(ip), getSiteSettings(), getFirewallRules()]);

    // Order matters: the admin's allow list beats everything (so they
    // can't lock out their own office), then country blocks, then path /
    // user-agent blocks (this request only - the IP isn't listed), then
    // individual IP blocks (expired ones no longer count), then the
    // strict firewall policy, which scores this request against the same
    // signature rules the admin Pentester page displays and auto-blocks /
    // emails an alert when it crosses the admin-set thresholds. See
    // lib/security/firewall.js for the policy itself.
    let isBlocked = false;
    if (rules.allowIps.has(ip)) {
      isBlocked = false;
    } else if (country && rules.blockedCountries.has(String(country).toUpperCase())) {
      isBlocked = true;
    } else if (matchRequestRule(rules, path, ua)) {
      isBlocked = true;
    } else {
      isBlocked = await enforceFirewallPolicy({
        supabase,
        ip,
        path,
        method,
        userAgent: ua,
        country,
        city,
        fetchSite,
        alreadyBlocked: blockIsActive(blockedRow),
        policy: settings.firewall,
        alertTo: alertRecipients(settings),
      });
    }

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

    return Response.json({ ok: true, isBlocked, maintenance: settings.maintenance?.enabled === true });
  } catch (err) {
    // Never let logging errors surface to callers
    return Response.json({ ok: true, isBlocked: false });
  }
}