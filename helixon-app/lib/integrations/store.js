// Stored OAuth connections (integration_connections, migration
// 20261003050000). Tokens are sealed with lib/secret-box.js; accessToken()
// refreshes them when they're about to expire.

import { supabase } from "@/lib/supabase";
import { open, seal, secretBoxReady } from "@/lib/secret-box";
import { fetchTokens, providerConfigured, providerFor } from "@/lib/integrations/providers";

const COLUMNS = "id, agency_id, user_id, provider, account_id, account_name, tokens, expires_at, sync_cursor, last_synced_at, last_error, connected_by, created_at";

// Whether a provider can be connected at all: its app credentials, the
// encryption key, and the table.
export function integrationReady(provider) {
  return providerConfigured(provider) && secretBoxReady();
}

export function isMissingTable(error) {
  return error && (error.code === "42P01" || error.code === "PGRST205");
}

// The agency's (or, for a member-scoped provider, this person's)
// connection, or null.
export async function getConnection(agencyId, provider, userId = null) {
  const p = providerFor(provider);
  if (!p) return null;
  let q = supabase.from("integration_connections").select(COLUMNS).eq("agency_id", agencyId).eq("provider", provider);
  q = p.scope === "member" ? q.eq("user_id", userId) : q.is("user_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (!isMissingTable(error)) console.error("[integrations] load failed:", error.message);
    return null;
  }
  return data;
}

// What the settings page shows - never the tokens.
export function publicConnection(row) {
  if (!row) return null;
  return {
    provider: row.provider,
    accountId: row.account_id,
    accountName: row.account_name,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    connectedAt: row.created_at,
  };
}

export async function saveConnection({ agencyId, provider, userId = null, tokens, accountId = null, accountName = null, connectedBy }) {
  const p = providerFor(provider);
  const owner = p.scope === "member" ? userId : null;
  const fields = {
    account_id: accountId ? String(accountId).slice(0, 200) : null,
    account_name: accountName ? String(accountName).slice(0, 300) : null,
    tokens: seal(tokens),
    expires_at: tokens.expiresAt,
    last_error: null,
    connected_by: connectedBy,
    updated_at: new Date().toISOString(),
  };
  const existing = await getConnection(agencyId, provider, owner);
  if (existing) {
    // A different account (another Xero organisation, another mailbox)
    // starts its sync again.
    if (existing.account_id !== fields.account_id) fields.sync_cursor = null;
    const { error } = await supabase.from("integration_connections").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("integration_connections").insert({ agency_id: agencyId, provider, user_id: owner, ...fields });
  if (error) throw new Error(error.message);
}

export async function removeConnection(agencyId, provider, userId = null) {
  const row = await getConnection(agencyId, provider, userId);
  if (!row) return false;
  const { error } = await supabase.from("integration_connections").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
  return true;
}

export async function updateConnection(id, fields) {
  await supabase.from("integration_connections").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
}

// A usable access token for a connection row, refreshing (and saving the
// new tokens) when it expires within a minute. Throws if the connection has
// to be made again.
export async function accessToken(row) {
  const tokens = open(row.tokens);
  if (!tokens?.accessToken) throw new Error("The connection can't be read - connect it again.");
  if (new Date(tokens.expiresAt || 0).getTime() - Date.now() > 60000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new Error("The connection has expired - connect it again.");
  let fresh;
  try {
    fresh = await fetchTokens(row.provider, { refreshToken: tokens.refreshToken });
  } catch (err) {
    await updateConnection(row.id, { last_error: `Reconnect needed: ${err.message}`.slice(0, 1000) });
    throw new Error("The connection has expired - connect it again.");
  }
  await updateConnection(row.id, { tokens: seal(fresh), expires_at: fresh.expiresAt });
  return fresh.accessToken;
}
