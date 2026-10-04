"use client";

// Dashboard API calls: opportunities (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

// Business development - app/api/opportunities, lib/opportunities.js.
export async function getOpportunities({ clientId } = {}) {
  const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  return apiFetch(`/api/opportunities${q}`);
}

export async function createOpportunity(fields) {
  const res = await apiFetch("/api/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.opportunity;
}

export async function updateOpportunity(id, fields) {
  const res = await apiFetch(`/api/opportunities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.opportunity;
}

export async function deleteOpportunity(id) {
  return apiFetch(`/api/opportunities/${id}`, { method: "DELETE" });
}
