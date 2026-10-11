"use client";

// Dashboard API calls: placements (re-exported by lib/dashboard-api.js).

import { track } from "@/lib/analytics";
import { apiFetch, jsonBody } from "./core";


/** @param {Record<string, string | undefined>} [query] */
export async function getPlacements(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const res = await apiFetch(`/api/placements?${params.toString()}`);
  // Carried on the array so callers keep using it as a list.
  const list = res.placements;
  list.financialsHidden = Boolean(res.financialsHidden);
  return list;
}

/** @param {string} id */
export async function getPlacement(id) {
  return apiFetch(`/api/placements/${id}`);
}

/** @param {import("./core").Fields} fields */
export async function createPlacement(fields) {
  const res = await apiFetch("/api/placements", jsonBody("POST", fields));
  track("placement_created");
  return res.placement;
}

/** @param {string} id @param {import("./core").Fields} fields */
export async function updatePlacement(id, fields) {
  const res = await apiFetch(`/api/placements/${id}`, jsonBody("PATCH", fields));
  return res.placement;
}

/** @param {string} id */
export async function deletePlacement(id) {
  return apiFetch(`/api/placements/${id}`, { method: "DELETE" });
}

/** @param {string} placementId @param {import("./core").Fields} fields */
export async function saveTimesheet(placementId, fields) {
  return apiFetch(`/api/placements/${placementId}/timesheets`, jsonBody("POST", fields));
}

/** @param {string} placementId @param {string} timesheetId @param {string} status */
export async function reviewTimesheet(placementId, timesheetId, status) {
  return apiFetch(`/api/placements/${placementId}/timesheets`, jsonBody("PATCH", { timesheetId, status }));
}

/** @param {string} placementId @param {string} timesheetId */
export async function deleteTimesheet(placementId, timesheetId) {
  return apiFetch(`/api/placements/${placementId}/timesheets?timesheetId=${encodeURIComponent(timesheetId)}`, { method: "DELETE" });
}

/** @param {string} placementId @param {import("./core").Fields} [fields] */
export async function raiseInvoice(placementId, fields = {}) {
  const res = await apiFetch(`/api/placements/${placementId}/invoice`, jsonBody("POST", fields));
  return res.invoice;
}

/** @param {string | undefined} status */
export async function getInvoices(status) {
  const res = await apiFetch(`/api/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  return res.invoices;
}

/** @param {string} id */
export async function getInvoice(id) {
  return apiFetch(`/api/invoices/${id}`);
}

/** @param {string} id @param {import("./core").Fields} fields */
export async function updateInvoice(id, fields) {
  const res = await apiFetch(`/api/invoices/${id}`, jsonBody("PATCH", fields));
  return res.invoice;
}

export async function getInvoicingSettings() {
  return apiFetch("/api/invoicing-settings");
}

/** @param {import("./core").Fields} fields */
export async function saveInvoicingSettings(fields) {
  return apiFetch("/api/invoicing-settings", jsonBody("PATCH", fields));
}

// Invoices for Xero / QuickBooks, or a payroll sheet - app/api/exports/accounting.
/** @param {string} format @param {{ from?: string, to?: string }} [range] */
export async function getAccountingExport(format, { from, to } = {}) {
  const q = new URLSearchParams({ format });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await apiFetch(`/api/exports/accounting?${q.toString()}`);
  return res.rows;
}

// Sends an invoice to the connected Xero / QuickBooks, or checks whether
// it's been paid there. Resolves { provider, externalId, status, pushed, label }.
/** @param {string} id */
export async function syncInvoiceToAccounts(id) {
  return apiFetch(`/api/invoices/${id}/accounting`, { method: "POST" });
}
