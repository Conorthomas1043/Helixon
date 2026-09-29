// lib/security/rules.js
// The admin-managed firewall rules (public.firewall_rules): an allow list of
// IPs that are never blocked or scored, countries whose every request is
// refused, and request paths (prefix) or user agents (fragment) that are
// refused wherever they come from. Read on every request by
// /api/internal/edge-log, so it's cached in memory per server instance for
// CACHE_MS and fails open (no rules) if the database can't be reached - a
// rules hiccup must never block visitors.

import { supabase } from "@/lib/supabase";

const CACHE_MS = 30_000;
let cache = null;

export const RULE_KINDS = ["allow_ip", "block_country", "block_path", "block_ua"];

// Paths a rule may never cover: the console, the staff portal, the pages a
// blocked visitor is sent to, and the endpoints other services call.
const PROTECTED_PATHS = ["/admin", "/api/admin", "/employee", "/api/employee", "/_next", "/api/internal", "/api/webhooks", "/api/cron", "/under-development", "/rate-limited"];

// User-agent fragments every ordinary browser sends; blocking one would
// block (nearly) everyone.
const COMMON_UA_TOKENS = ["mozilla", "applewebkit", "webkit", "chrome", "safari", "gecko", "firefox", "edge", "windows", "macintosh", "mac os", "android", "iphone", "ipad", "linux", "mobile", "khtml", "like gecko", "version"];

/** An error message when `value` can't be a rule of this kind, else null. */
export function ruleProblem(kind, value) {
  const v = String(value || "").trim();
  if (kind === "block_path") {
    if (!v.startsWith("/") || v.length < 2 || v.length > 64) return "Paths start with / and are 2-64 characters, like /wp-admin.";
    const lower = v.toLowerCase();
    if (PROTECTED_PATHS.some((p) => p.startsWith(lower) || lower.startsWith(p))) return "That path would block part of the admin console, staff portal or a service endpoint.";
    return null;
  }
  if (kind === "block_ua") {
    if (v.length < 3 || v.length > 64) return "Use 3-64 characters of the user agent, like sqlmap.";
    const lower = v.toLowerCase();
    if (COMMON_UA_TOKENS.some((t) => t.includes(lower))) return "Every normal browser sends that - it would block almost everyone.";
    return null;
  }
  return null;
}

function active(rule, now) {
  return !rule.expires_at || new Date(rule.expires_at).getTime() > now;
}

/** Split active rules into lookup sets. Exported for tests. */
export function indexRules(rows, now = Date.now()) {
  const allowIps = new Set();
  const blockedCountries = new Set();
  const blockedPaths = [];
  const blockedAgents = [];
  for (const rule of rows || []) {
    if (!active(rule, now)) continue;
    const value = String(rule.value).trim();
    if (rule.kind === "allow_ip") allowIps.add(value);
    if (rule.kind === "block_country") blockedCountries.add(value.toUpperCase());
    if (rule.kind === "block_path") blockedPaths.push(value.toLowerCase());
    if (rule.kind === "block_ua") blockedAgents.push(value.toLowerCase());
  }
  return { allowIps, blockedCountries, blockedPaths, blockedAgents };
}

/** The path or user-agent rule a request matches, or null. */
export function matchRequestRule(rules, path, userAgent) {
  const p = String(path || "").toLowerCase();
  const ua = String(userAgent || "").toLowerCase();
  const pathRule = (rules.blockedPaths || []).find((prefix) => p.startsWith(prefix));
  if (pathRule) return { kind: "block_path", value: pathRule };
  const uaRule = ua ? (rules.blockedAgents || []).find((fragment) => ua.includes(fragment)) : null;
  return uaRule ? { kind: "block_ua", value: uaRule } : null;
}

export async function getFirewallRules({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cache && now - cache.at < CACHE_MS) return cache.value;
  try {
    const { data, error } = await supabase.from("firewall_rules").select("kind,value,expires_at");
    if (error) throw error;
    const value = indexRules(data, now);
    cache = { at: now, value };
    return value;
  } catch (error) {
    console.error("[firewall-rules] Load failed, using none:", error?.message || error);
    return cache?.value || indexRules([]);
  }
}

export function clearFirewallRulesCache() {
  cache = null;
}

/** True when a blocked_ips row is still in force (no expiry, or not yet reached). */
export function blockIsActive(row, now = Date.now()) {
  return Boolean(row) && (!row.expires_at || new Date(row.expires_at).getTime() > now);
}

/** ISO 3166-1 alpha-2, as Vercel's x-vercel-ip-country sends it. */
export function isCountryCode(value) {
  return typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim());
}
