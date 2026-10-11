"use client";

// Shared fetch helpers (re-exported by lib/dashboard-api.js).
//
// Responses that have a contract (lib/contracts/) are typed with it in the
// area modules: `@returns {Promise<BillingSummary>}` on the function makes
// apiFetch's T the contract type, so a key the route doesn't send is a type
// error here rather than `undefined` on a page.

import { OFFLINE_MESSAGE, announceSignedOut, responseErrorMessage } from "@/lib/api-errors";

// A request body as the area modules pass it on: the fields a page filled
// in, checked by the route's schema (lib/api/schemas.js).
/** @typedef {Record<string, unknown>} Fields */

/**
 * @template [T=any]
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
export async function apiFetch(url, options) {
  let res;
  try {
    res = await fetch(url, { credentials: "include", ...options });
  } catch (err) {
    // A deliberate cancel isn't a connection problem.
    if (err instanceof Error && err.name === "AbortError") throw err;
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
/** @param {string} method @param {unknown} body @returns {RequestInit} */
export const jsonBody = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
