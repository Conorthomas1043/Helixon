// API keys for the agency's REST API (/api/v1) - used by their own scripts,
// Zapier and the LinkedIn extension. A key acts for the agency, as the
// teammate who made it; only its SHA-256 hash is stored (migration
// 20261001085000), so a key can be shown once and never again.

import "server-only";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { getAgencyControls } from "@/lib/agency-controls";
import { agencyHasActiveSubscription } from "@/lib/customer-auth";
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

// The key from "Authorization: Bearer hx_..." or "X-API-Key: hx_...".
export function readApiKey(headers) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") || "")?.[1];
  const key = bearer || headers.get("x-api-key") || "";
  return key.startsWith(KEY_PREFIX) && key.length >= 20 && key.length <= 100 ? key : null;
}

// { ok: true, agencyId, userId, keyId, actor } or { ok: false, status, error }.
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
