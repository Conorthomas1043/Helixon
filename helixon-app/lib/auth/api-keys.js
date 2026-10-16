// API keys for the agency's REST API (/api/v1) - used by their own scripts,
// Zapier and the LinkedIn extension. A key acts for the agency, as the
// teammate who made it; only its SHA-256 hash is stored (migration
// 20261001085000), so a key can be shown once and never again.

import "server-only";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { getAgencyControls } from "@/lib/agency/controls";
import { agencyHasActiveSubscription } from "@/lib/auth/customer-auth";
import { canManageWorkspace } from "@/lib/agency/workspace-admin";
import { rateLimit } from "@/lib/ratelimit";

export const KEY_PREFIX = "hx_";
export const API_RATE_PER_HOUR = 1000;

export function hashApiKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

export function generateApiKey() {
  const key = `${KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10), hash: hashApiKey(key) };
}

// A key acts with the whole workspace's access (every candidate, every
// fee), which only the owner and admins have, and only they can make one.
// So it stops working once its maker stops being one. Asking Clerk on
// every call is slow, so the answer is kept for a minute.
const ADMIN_CACHE_MS = 60_000;
const adminCache = new Map(); // `${agencyId}:${userId}` -> { admin, until }

async function makerIsAdmin(agencyId, userId) {
  const key = `${agencyId}:${userId}`;
  const hit = adminCache.get(key);
  if (hit && hit.until > Date.now()) return hit.admin;
  const admin = await canManageWorkspace({ agencyId, userId }).catch(() => false);
  if (adminCache.size > 5000) adminCache.clear();
  adminCache.set(key, { admin, until: Date.now() + ADMIN_CACHE_MS });
  return admin;
}

export function _clearApiKeyCache() {
  adminCache.clear();
}

// The key from "Authorization: Bearer hx_..." or "X-API-Key: hx_...".
export function readApiKey(headers) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") || "")?.[1];
  const key = bearer || headers.get("x-api-key") || "";
  return key.startsWith(KEY_PREFIX) && key.length >= 20 && key.length <= 100 ? key : null;
}

/**
 * @param {Request} request
 * @returns {Promise<
 *   | { ok: false, status: 401 | 402 | 403 | 429, error: string, agencyId?: undefined }
 *   | { ok: true, agencyId: string, userId: string, keyId: string, actor: string, profile: any, status?: undefined, error?: undefined }
 * >}
 */
export async function authenticateApiKey(request) {
  const key = readApiKey(request.headers);
  if (!key) return { ok: false, status: 401, error: "Send your API key as 'Authorization: Bearer hx_...'." };
  const { data: row } = await supabase.from("api_keys").select("id, agency_id, name, created_by, revoked_at, last_used_at").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (!row || row.revoked_at) return { ok: false, status: 401, error: "That API key isn't valid." };

  // The key's maker must still be in the agency, and the agency active.
  const [{ data: owner }, controls, subscribed] = await Promise.all([
    supabase.from("profiles").select("clerk_user_id, first_name, last_name, username, agency_id").eq("clerk_user_id", row.created_by).maybeSingle(),
    getAgencyControls(row.agency_id),
    agencyHasActiveSubscription(row.agency_id).catch(() => false),
  ]);
  if (!owner || owner.agency_id !== row.agency_id) return { ok: false, status: 401, error: "The person who made this key has left the workspace - make a new one." };
  if (!(await makerIsAdmin(row.agency_id, row.created_by))) {
    return { ok: false, status: 403, error: "The person who made this key is no longer a workspace admin - an admin needs to make a new one." };
  }
  if (controls.suspended) return { ok: false, status: 403, error: "This workspace is suspended." };
  if (!subscribed) return { ok: false, status: 402, error: "The workspace needs an active subscription to use the API." };
  if (!(await rateLimit(`api-key:${row.id}`, API_RATE_PER_HOUR))) return { ok: false, status: 429, error: "Too many requests - the limit is 1,000 an hour." };

  // last_used_at at most every five minutes.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 300000) {
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  }
  const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.username || "API";
  return { ok: true, agencyId: row.agency_id, userId: row.created_by, keyId: row.id, actor: `${ownerName} (via ${row.name})`, profile: owner };
}
