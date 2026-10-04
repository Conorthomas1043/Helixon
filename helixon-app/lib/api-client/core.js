"use client";

// Shared fetch helpers (re-exported by lib/dashboard-api.js).

import { OFFLINE_MESSAGE, announceSignedOut, responseErrorMessage } from "@/lib/api-errors";

export async function apiFetch(url, options) {
  let res;
  try {
    res = await fetch(url, { credentials: "include", ...options });
  } catch (err) {
    // A deliberate cancel isn't a connection problem.
    if (err?.name === "AbortError") throw err;
    throw new Error(OFFLINE_MESSAGE);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) announceSignedOut();
    throw new Error(responseErrorMessage(res.status, data));
  }
  return data;
}

// Offers, placements, invoices and timesheets - see app/api/placements,
// app/api/invoices and app/api/invoicing-settings.
export const jsonBody = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
