// lib/ops/health-checks.js
// Infrastructure/product health checks that lib/ops/live-services.js doesn't
// cover: the database itself, the AI providers the core product runs on,
// and a live check that key public pages actually render. Combined with
// live-services.js's Stripe/Clerk/Redis/Resend/Sentry snapshots in
// app/api/admin/health/route.js for a single "is the site actually working"
// view (app/admin/health, and a condensed version on /admin/mobile).
//
// Every function here is defensive by design: a failure in one check must
// never throw and take the others down with it - each returns its own
// { configured, ok, error } shape and getFullHealthSnapshot() Promise.all's
// them all in parallel.

import { getAdminSupabase } from "@/lib/admin-supabase";
import { isAdminRouteHidden } from "@/lib/admin-auth";

const FETCH_TIMEOUT_MS = 8000;

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

/** Round-trip latency + reachability for the actual product database - every
 * other admin page reads through it, but nothing previously checked it live
 * (the Command page's "Supabase" row was a hardcoded "Connected", true or not). */
export async function getDatabaseSnapshot() {
  try {
    const supabase = getAdminSupabase();
    const start = Date.now();
    const { error } = await supabase.from("agencies").select("id", { head: true, count: "exact" });
    const latencyMs = Date.now() - start;

    if (error) {
      return { configured: true, connected: false, error: error.message };
    }
    return { configured: true, connected: true, latencyMs };
  } catch (error) {
    return { configured: true, connected: false, error: error.message || "Failed to reach the database." };
  }
}

/** Anthropic (Claude) - powers the whole CV-analysis pipeline
 * (lib/cv-analysis/anthropic.js). /v1/models is a metadata endpoint: it
 * lists available models and does not run a completion, so checking it
 * here on every admin health-page load costs nothing. */
async function getAnthropicSnapshot() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { configured: false };

  try {
    const { response, latencyMs } = await timedFetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { configured: true, connected: false, error: `Anthropic API returned HTTP ${response.status}` };
    }
    return { configured: true, connected: true, latencyMs };
  } catch (error) {
    return { configured: true, connected: false, error: error.message || "Failed to reach Anthropic." };
  }
}

/** Gemini - powers the public chat assistant (app/api/assistant). Google's
 * models.list is likewise a free metadata call, not a generation. */
async function getGeminiSnapshot() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { configured: false };

  try {
    const { response, latencyMs } = await timedFetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return { configured: true, connected: false, error: `Gemini API returned HTTP ${response.status}` };
    }
    return { configured: true, connected: true, latencyMs };
  } catch (error) {
    return { configured: true, connected: false, error: error.message || "Failed to reach Gemini." };
  }
}

/** Voyage - embeddings for CV/job semantic skill matching
 * (lib/cv-analysis/scoring/embeddingMatcher.js). Voyage doesn't document a
 * free metadata endpoint the way Anthropic/Google do, and its API is
 * embeddings-only - every real call is billable. Reporting "configured"
 * (key present) rather than doing a live call, so this page never spends
 * money just by being loaded. */
function getVoyageSnapshot() {
  return { configured: Boolean(process.env.VOYAGE_API_KEY) };
}

export async function getAiProvidersSnapshot() {
  const [anthropic, gemini] = await Promise.all([getAnthropicSnapshot(), getGeminiSnapshot()]);
  return { anthropic, gemini, voyage: getVoyageSnapshot() };
}

// ── Public page checks ──────────────────────────────────────────────────
// A small, deliberately non-exhaustive set of pages that should always
// return 200 for a signed-out visitor - marketing/legal pages plus the
// three separate sign-in surfaces (customer, employee, admin). Catches the
// class of bug this session already found once for real (a route 500ing
// for everyone, e.g. app/api/employee/ops's since-fixed bad column) but at
// the page level instead of just one route.
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/about",
  "/how-it-works",
  "/faq",
  "/contact",
  "/careers",
  "/blog",
  "/privacy",
  "/terms",
  "/cookie-policy",
  "/dpa",
  "/login",
  "/signup",
  "/employee/login",
];

function adminLoginPath() {
  // Mirrors proxy.ts's HIDE_ADMIN behaviour: when ADMIN_LOGIN_SLUG is set,
  // /admin/login 404s on purpose and the slug is the real entrance -
  // checking the wrong one would misreport a correctly-hidden route as broken.
  if (isAdminRouteHidden()) {
    return `/${(process.env.ADMIN_LOGIN_SLUG || "").replace(/^\/+|\/+$/g, "")}`;
  }
  return "/admin/login";
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
}

async function checkPage(origin, path) {
  const url = `${origin}${path}`;
  try {
    const { response, latencyMs } = await timedFetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "Helixon-AdminHealthCheck/1.0" },
    });
    // Drain the body without holding onto it - we only need the status.
    response.body?.cancel?.().catch(() => {});
    const status = response.status;
    // A same-origin redirect (e.g. www <-> apex, or a trailing-slash
    // normalisation) is normal, not a failure - only flag it if it's not a
    // plain 2xx/3xx.
    const ok = status >= 200 && status < 400;
    return { path, ok, status, latencyMs };
  } catch (error) {
    return { path, ok: false, status: null, error: error.name === "AbortError" ? "Timed out" : error.message };
  }
}

export async function getPageChecks() {
  const origin = siteOrigin();
  const paths = [...PUBLIC_PATHS, adminLoginPath()];
  const results = await Promise.all(paths.map((path) => checkPage(origin, path)));
  return {
    origin,
    checkedAt: new Date().toISOString(),
    pages: results,
    failing: results.filter((r) => !r.ok).length,
  };
}

/** Everything above, fetched in parallel and tolerant of individual failures. */
export async function getFullHealthChecksSnapshot() {
  const [database, aiProviders, pages] = await Promise.all([
    getDatabaseSnapshot(),
    getAiProvidersSnapshot(),
    getPageChecks(),
  ]);
  return { database, aiProviders, pages };
}
