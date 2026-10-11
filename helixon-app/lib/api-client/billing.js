"use client";

// Dashboard API calls: billing (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

/** @typedef {import("@/lib/contracts/billing").BillingSummary} BillingSummary */

// The Billing page's plan and subscription - app/api/billing.
/** @returns {Promise<BillingSummary>} */
export async function getBillingSummary() {
  return apiFetch("/api/billing");
}
