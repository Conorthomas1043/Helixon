"use client";

// Dashboard API calls: integrations (re-exported by lib/dashboard-api.js).

import { apiFetch, jsonBody } from "./core";

// API keys and webhooks - see app/api/integrations.
export async function getApiKeys() {
  const res = await apiFetch("/api/integrations/keys");
  return res.keys;
}

export async function createApiKey(name) {
  return apiFetch("/api/integrations/keys", jsonBody("POST", { name }));
}

export async function revokeApiKey(id) {
  return apiFetch(`/api/integrations/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getWebhooks() {
  return apiFetch("/api/integrations/webhooks");
}

export async function addWebhook(fields) {
  const res = await apiFetch("/api/integrations/webhooks", jsonBody("POST", fields));
  return res.endpoint;
}

export async function updateWebhook(id, fields) {
  return apiFetch("/api/integrations/webhooks", jsonBody("PATCH", { id, ...fields }));
}

export async function deleteWebhook(id) {
  return apiFetch(`/api/integrations/webhooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Connected services - app/api/integrations/connections (Xero, QuickBooks,
// your Gmail / Outlook). Connecting is a full-page visit to
// /api/integrations/oauth/<provider>/connect.
export async function getConnections() {
  return apiFetch("/api/integrations/connections");
}

export async function disconnectIntegration(provider) {
  return apiFetch(`/api/integrations/connections?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
}

export async function syncIntegration(provider) {
  return apiFetch("/api/integrations/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync", provider }),
  });
}
