// lib/site-settings.js
// Site-wide switches an admin controls from /admin/site, stored in the
// `site_settings` table (one row per key, value jsonb):
//
//   maintenance   { enabled, message }  public pages go to /under-development
//   announcement  { enabled, text, tone, linkLabel, linkUrl }  banner on the site
//   features      { chat_assistant, demo_requests, checkout, employee_portal }
//   firewall      { blockThreshold, alertThreshold, autoBlock, autoBlockHours, emailAlerts }
//   health        { muted }  health checks that don't count toward the overall status
//   alerts        { recipients, healthDigest }  who gets firewall and health emails
//   traffic       { captureHeaders, capturePayloads, detailDays }  request inspector capture,
//                 { retentionDays, logMonitors }  how long log lines are kept, uptime pings
//                 { spikeAlerts, spikeMultiplier, spikeMinRequests, floodRequests }  lib/traffic-alerts.js
//
// Reads are cached in memory for CACHE_MS per server instance, so a change
// takes up to that long to reach every instance. Everything fails open to
// DEFAULTS: a database hiccup must never take the site down or switch a
// feature off.

import { supabase } from "@/lib/supabase";
import { HEALTH_CHECK_KEYS } from "@/lib/ops/health-grade";

const CACHE_MS = 30_000;

export const TONES = ["info", "warn", "success"];

export const FEATURES = [
  { key: "chat_assistant", label: "Chat assistant", description: "The \"Ask Helixon\" chat bubble on the homepage and blog." },
  { key: "demo_requests", label: "Demo requests", description: "The book-a-demo form. When off, submissions are refused with a friendly message." },
  { key: "checkout", label: "New subscriptions", description: "Stripe checkout for new plans. Existing subscriptions keep working." },
  { key: "employee_portal", label: "Staff portal", description: "Employee sign-in and the /employee pages. Admins can still open it from the console." },
];

// Firewall defaults keep the env-var thresholds lib/security/firewall.js
// has always used, so nothing changes until an admin edits them.
const ENV_BLOCK = Number(process.env.FIREWALL_BLOCK_THRESHOLD) || 30;
const ENV_ALERT = Number(process.env.FIREWALL_ALERT_THRESHOLD) || 20;

export const DEFAULTS = Object.freeze({
  maintenance: { enabled: false, message: "" },
  announcement: { enabled: false, text: "", tone: "info", linkLabel: "", linkUrl: "" },
  features: Object.fromEntries(FEATURES.map((f) => [f.key, true])),
  firewall: { blockThreshold: ENV_BLOCK, alertThreshold: Math.min(ENV_ALERT, ENV_BLOCK), autoBlock: true, autoBlockHours: 0, emailAlerts: true, blockOnQuery: false },
  health: { muted: [] },
  alerts: { recipients: [], healthDigest: true },
  traffic: {
    captureHeaders: true,
    capturePayloads: true,
    detailDays: 14,
    retentionDays: 90,
    logMonitors: false,
    spikeAlerts: true,
    spikeMultiplier: 5,
    spikeMinRequests: 300,
    floodRequests: 300,
  },
});

// How long full request detail (headers, query, blocked payloads) is kept
// before the daily cron clears it; the basic log line stays.
export const DETAIL_DAYS = [3, 7, 14, 30];

// How long a request log line (IP, browser, location, path) is kept at all
// before the daily cron deletes it. The privacy policy promises at most 90.
export const RETENTION_DAYS = [30, 60, 90];

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function int(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export const SETTING_KEYS = Object.keys(DEFAULTS);

function str(value, max) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

// Only site-relative paths or http(s) URLs; anything else (javascript:,
// data:) is dropped.
function safeLink(value) {
  const url = str(value, 300);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

/** A valid, complete value for `key` built from (untrusted) `raw`. */
export function cleanSetting(key, raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (key === "maintenance") {
    return { enabled: value.enabled === true, message: str(value.message, 400) };
  }
  if (key === "announcement") {
    const text = str(value.text, 240);
    const linkUrl = safeLink(value.linkUrl);
    return {
      enabled: value.enabled === true && Boolean(text),
      text,
      tone: TONES.includes(value.tone) ? value.tone : "info",
      linkLabel: linkUrl ? str(value.linkLabel, 40) : "",
      linkUrl,
    };
  }
  if (key === "firewall") {
    const d = DEFAULTS.firewall;
    const blockThreshold = int(value.blockThreshold, 10, 200, d.blockThreshold);
    return {
      blockThreshold,
      // Alerting above the block line would never fire.
      alertThreshold: Math.min(int(value.alertThreshold, 5, 200, d.alertThreshold), blockThreshold),
      autoBlock: value.autoBlock !== false,
      // 0 = permanent; otherwise auto-blocks lift after this many hours.
      autoBlockHours: int(value.autoBlockHours, 0, 24 * 90, d.autoBlockHours),
      emailAlerts: value.emailAlerts !== false,
      blockOnQuery: value.blockOnQuery === true,
    };
  }
  if (key === "traffic") {
    const days = Number(value.detailDays);
    const keep = Number(value.retentionDays);
    const d = DEFAULTS.traffic;
    return {
      captureHeaders: value.captureHeaders !== false,
      capturePayloads: value.capturePayloads !== false,
      detailDays: DETAIL_DAYS.includes(days) ? days : 14,
      retentionDays: RETENTION_DAYS.includes(keep) ? keep : d.retentionDays,
      logMonitors: value.logMonitors === true,
      spikeAlerts: value.spikeAlerts !== false,
      spikeMultiplier: int(value.spikeMultiplier, 2, 50, d.spikeMultiplier),
      spikeMinRequests: int(value.spikeMinRequests, 20, 1_000_000, d.spikeMinRequests),
      floodRequests: int(value.floodRequests, 20, 1_000_000, d.floodRequests),
    };
  }
  if (key === "alerts") {
    const list = Array.isArray(value.recipients) ? value.recipients : String(value.recipients || "").split(/[\s,;]+/);
    const recipients = [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter((e) => e.length <= 254 && EMAIL_RE.test(e)))].slice(0, 10);
    return { recipients, healthDigest: value.healthDigest !== false };
  }
  if (key === "health") {
    const muted = Array.isArray(value.muted) ? value.muted : [];
    return { muted: HEALTH_CHECK_KEYS.filter((k) => muted.includes(k)) };
  }
  if (key === "features") {
    // Missing keys stay on: only an explicit false turns something off.
    return Object.fromEntries(FEATURES.map((f) => [f.key, value[f.key] !== false]));
  }
  throw new Error(`Unknown site setting: ${key}`);
}

let cache = null;

async function load() {
  const { data, error } = await supabase.from("site_settings").select("key,value,updated_at,updated_by");
  if (error) throw error;
  const settings = { ...DEFAULTS };
  const meta = {};
  for (const row of data || []) {
    if (!SETTING_KEYS.includes(row.key)) continue;
    settings[row.key] = cleanSetting(row.key, row.value);
    meta[row.key] = { updatedAt: row.updated_at, updatedBy: row.updated_by };
  }
  return { settings, meta };
}

/**
 * Current settings ({ maintenance, announcement, features }). `fresh`
 * skips the cache (the admin page uses it); `withMeta` also returns who
 * changed each key and when.
 */
export async function getSiteSettings({ fresh = false, withMeta = false } = {}) {
  const now = Date.now();
  if (!fresh && cache && now - cache.at < CACHE_MS) {
    return withMeta ? cache.value : cache.value.settings;
  }
  try {
    const value = await load();
    cache = { at: now, value };
    return withMeta ? value : value.settings;
  } catch (error) {
    console.error("[site-settings] Load failed, using defaults:", error?.message || error);
    const value = cache?.value || { settings: { ...DEFAULTS }, meta: {} };
    return withMeta ? { ...value, unavailable: true } : value.settings;
  }
}

export async function isFeatureEnabled(feature) {
  const settings = await getSiteSettings();
  return settings.features?.[feature] !== false;
}

/** Saves one key (already cleaned) and refreshes this instance's cache. */
export async function saveSiteSetting(key, value, adminUsername) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: adminUsername }, { onConflict: "key" });
  if (error) throw error;
  cache = null;
}

/** What the public site is allowed to know. */
export function publicSiteSettings(settings) {
  const a = settings.announcement;
  const m = settings.maintenance;
  return {
    maintenance: m?.enabled ? { message: m.message } : null,
    announcement: a?.enabled ? { text: a.text, tone: a.tone, linkLabel: a.linkLabel, linkUrl: a.linkUrl } : null,
    features: { chat_assistant: settings.features?.chat_assistant !== false },
  };
}

/** Standard "switched off" JSON for a feature an admin has disabled. */
export function featureOffResponse(message) {
  return Response.json({ ok: false, error: message, code: "feature_disabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

/**
 * Who gets admin alert emails: the addresses set on the Security page, or
 * SECURITY_ALERT_EMAIL (comma-separated) when none are set.
 */
export function alertRecipients(settings) {
  const set = settings?.alerts?.recipients || [];
  if (set.length) return set;
  return String(process.env.SECURITY_ALERT_EMAIL || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}
