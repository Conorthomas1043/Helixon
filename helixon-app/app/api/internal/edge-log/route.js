// app/api/internal/edge-log/route.js
// Called by proxy.ts on every request.
// - POST: records the request in request_logs and returns
//   { isBlocked, maintenance, capturePayload } so proxy.ts can gate it
//   (maintenance is the admin's switch on /admin/site, cached in
//   lib/site-settings.js)
// - PATCH: proxy.ts reports what happened next when it decides after the
//   log line was written - a redirect (maintenance, sign-in), a hidden
//   admin 404, or the (redacted) body of a blocked request.
//
// What's kept per request, and what isn't, is in lib/request-capture.js:
// headers and query strings with secrets redacted, bodies only for blocked
// requests. The admin controls both on the Traffic page.
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
import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { enforceFirewallPolicy } from "@/lib/security/firewall";
import { scoreRequest } from "@/lib/security/threat-score";
import { alertRecipients, getSiteSettings } from "@/lib/site-settings";
import { blockIsActive, getFirewallRules, matchRange, matchRequestRule } from "@/lib/security/rules";
import { redactHeaders, redactPayload, redactQuery } from "@/lib/request-capture";

// blocked_ips.expires_at arrives with migration 20260929030000; until then
// every block is permanent, as before.
async function findBlock(ip) {
  let result = await supabase.from("blocked_ips").select("ip,expires_at").eq("ip", ip).maybeSingle();
  if (result.error?.code === "42703") result = await supabase.from("blocked_ips").select("ip").eq("ip", ip).maybeSingle();
  return result.data || null;
}

const INTERNAL_HEADER = "x-internal-secret";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["allowed", "blocked", "redirected", "not_found"]);
const RULES = new Set(["allow_list", "country", "ip_range", "path", "user_agent", "ip_block", "firewall", "maintenance", "sign_in", "admin"]);
// Columns added by migration 20260929040000 (request inspector).
const DETAIL_COLUMNS = ["uid", "host", "protocol", "query", "headers", "payload", "outcome", "status_code", "location", "rule", "threat_score", "signals", "region", "postal", "timezone", "edge_id"];

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authorised(request) {
  const expected = process.env.INTERNAL_EDGE_LOG_SECRET;
  if (!expected) {
    console.error("[edge-log] INTERNAL_EDGE_LOG_SECRET is not set - rejecting all requests.");
    return { ok: false, status: 503 };
  }
  if (!timingSafeEqualStr(expected, request.headers.get(INTERNAL_HEADER) || "")) return { ok: false, status: 401 };
  return { ok: true };
}

function short(value, max) {
  const s = String(value || "").trim();
  return s ? s.slice(0, max) : null;
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Inserts the log line. If the detail columns don't exist yet (migration
// not applied), retries with the original columns rather than losing it.
async function insertLog(row) {
  const { error } = await supabase.from("request_logs").insert(row);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const basic = { ...row };
    for (const column of DETAIL_COLUMNS) delete basic[column];
    await supabase.from("request_logs").insert(basic);
  } else if (error) {
    console.error("[edge-log] insert failed:", error.message);
  }
}

export async function POST(request) {
  try {
    const auth = authorised(request);
    if (!auth.ok) return Response.json({ ok: false, isBlocked: false }, { status: auth.status });

    const body = await request.json();
    const { ip, ua, method, path, ts, referer, country, city, lat, lon, fetchSite } = body;
    const rawQuery = String(body.query || "").replace(/^\?/, "");

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
    // can't lock out their own office), then country blocks, then blocked
    // IP ranges, then path / user-agent blocks (this request only - the IP
    // isn't listed), then individual IP blocks (expired ones no longer
    // count), then the strict firewall policy, which scores this request
    // against the same signature rules the admin Pentester page displays
    // and auto-blocks / emails an alert when it crosses the admin-set
    // thresholds. See lib/security/firewall.js for the policy itself.
    let isBlocked = false;
    let rule = null;
    let requestRule = null;
    if (rules.allowIps.has(ip)) {
      rule = "allow_list";
    } else if (country && rules.blockedCountries.has(String(country).toUpperCase())) {
      isBlocked = true;
      rule = "country";
    } else if (matchRange(rules, ip)) {
      isBlocked = true;
      rule = "ip_range";
    } else if ((requestRule = matchRequestRule(rules, path, ua))) {
      isBlocked = true;
      rule = requestRule.kind === "block_path" ? "path" : "user_agent";
    } else {
      const alreadyBlocked = blockIsActive(blockedRow);
      isBlocked = await enforceFirewallPolicy({
        supabase,
        ip,
        path,
        query: rawQuery,
        method,
        userAgent: ua,
        country,
        city,
        fetchSite,
        alreadyBlocked,
        policy: settings.firewall,
        alertTo: alertRecipients(settings),
      });
      if (isBlocked) rule = alreadyBlocked ? "ip_block" : "firewall";
    }

    // Recorded for every request, query included (the firewall only blocks
    // on query-string findings if the admin opted in).
    const threat = scoreRequest({ path, query: rawQuery, user_agent: ua, method });
    const capture = settings.traffic || {};
    const api = String(path || "").startsWith("/api");

    const row = {
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
      uid: UUID.test(body.uid || "") ? body.uid : null,
      host: short(body.host, 200),
      protocol: short(body.protocol, 10),
      query: capture.captureHeaders !== false ? redactQuery(rawQuery) || null : null,
      headers: capture.captureHeaders !== false && body.headers ? redactHeaders(body.headers) : null,
      outcome: isBlocked ? "blocked" : "allowed",
      status_code: isBlocked ? (api ? 403 : 307) : null,
      location: isBlocked && !api ? "/rate-limited" : null,
      rule,
      threat_score: threat.score,
      signals: threat.signals.length ? threat.signals : null,
      region: short(body.region, 20),
      postal: short(body.postal, 20),
      timezone: short(decode(body.timezone || ""), 60),
      edge_id: short(body.edgeId, 120),
    };

    // proxy.ts may report what happened next (a redirect, or a blocked
    // request's body) - for those requests the row has to exist first, so
    // wait for it. Everything else is written after the response is sent,
    // so logging never slows a page down.
    const mayFollowUp = isBlocked || settings.maintenance?.enabled === true || body.mayFollowUp === true;
    if (mayFollowUp) await insertLog(row);
    else after(() => insertLog(row));

    return Response.json({
      ok: true,
      isBlocked,
      maintenance: settings.maintenance?.enabled === true,
      capturePayload: isBlocked && capture.capturePayloads !== false,
    });
  } catch (err) {
    // Never let logging errors surface to callers
    return Response.json({ ok: true, isBlocked: false });
  }
}

// Follow-up from proxy.ts: { uid, outcome?, statusCode?, location?, rule?,
// payload?, contentType? }. The row is normally there already (POST waits
// for it when a follow-up is possible); a short retry covers the rest.
export async function PATCH(request) {
  try {
    const auth = authorised(request);
    if (!auth.ok) return Response.json({ ok: false }, { status: auth.status });

    const body = await request.json();
    if (!UUID.test(body.uid || "")) return Response.json({ ok: false }, { status: 400 });

    const update = {};
    if (OUTCOMES.has(body.outcome)) update.outcome = body.outcome;
    const status = Number(body.statusCode);
    if (Number.isInteger(status) && status >= 100 && status < 600) update.status_code = status;
    if (body.location) update.location = short(body.location, 300);
    if (RULES.has(body.rule)) update.rule = body.rule;
    if (body.payload) {
      const settings = await getSiteSettings();
      if (settings.traffic?.capturePayloads !== false) update.payload = redactPayload(body.payload, body.contentType);
    }
    if (!Object.keys(update).length) return Response.json({ ok: true });

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from("request_logs").update(update).eq("uid", body.uid).select("id");
      if (error || data?.length) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
