// lib/site-settings.js
// Site-wide switches an admin controls from /admin/site, stored in the
// `site_settings` table (one row per key, value jsonb):
//
//   maintenance   { enabled, message }  public pages go to /under-development
//   announcement  { enabled, text, tone, linkLabel, linkUrl }  banner on the site
//   features      { chat_assistant, demo_requests, checkout, employee_portal }
//
// Reads are cached in memory for CACHE_MS per server instance, so a change
// takes up to that long to reach every instance. Everything fails open to
// DEFAULTS: a database hiccup must never take the site down or switch a
// feature off.

import { supabase } from "@/lib/supabase";

const CACHE_MS = 30_000;

export const TONES = ["info", "warn", "success"];

export const FEATURES = [
  { key: "chat_assistant", label: "Chat assistant", description: "The \"Ask Helixon\" chat bubble on the homepage and blog." },
  { key: "demo_requests", label: "Demo requests", description: "The book-a-demo form. When off, submissions are refused with a friendly message." },
  { key: "checkout", label: "New subscriptions", description: "Stripe checkout for new plans. Existing subscriptions keep working." },
  { key: "employee_portal", label: "Staff portal", description: "Employee sign-in and the /employee pages. Admins can still open it from the console." },
];

export const DEFAULTS = Object.freeze({
  maintenance: { enabled: false, message: "" },
  announcement: { enabled: false, text: "", tone: "info", linkLabel: "", linkUrl: "" },
  features: Object.fromEntries(FEATURES.map((f) => [f.key, true])),
});

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
