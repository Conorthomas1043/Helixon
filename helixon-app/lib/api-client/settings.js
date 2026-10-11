"use client";

// Dashboard API calls: settings (re-exported by lib/dashboard-api.js).

import { apiFetch, jsonBody } from "./core";


// The agency's public jobs page settings - see app/api/careers.
export async function getCareersSettings() {
  return apiFetch("/api/careers");
}

/** @param {import("./core").Fields} fields */
export async function saveCareersSettings(fields) {
  return apiFetch("/api/careers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// Saved Candidates searches - see app/api/saved-searches.
/** @param {{ counts?: boolean }} [options] */
export async function getSavedSearches({ counts = false } = {}) {
  const res = await apiFetch(`/api/saved-searches${counts ? "?counts=1" : ""}`);
  return res.searches;
}

/** @param {import("./core").Fields} fields */
export async function saveSearch(fields) {
  const res = await apiFetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.search;
}

/** @param {string} id @param {import("./core").Fields} fields */
export async function updateSavedSearch(id, fields) {
  const res = await apiFetch(`/api/saved-searches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.search;
}

/** @param {string} id */
export async function deleteSavedSearch(id) {
  return apiFetch(`/api/saved-searches/${id}`, { method: "DELETE" });
}

// The agency's sub-stages and custom fields - see app/api/customisation.
// Read by many cards on one page, so fetched once per page load (and
// refreshed after saving).
/** @type {Promise<any> | null} */
let customisationPromise = null;

/** @param {{ fresh?: boolean }} [options] @returns {Promise<any>} */
export function getCustomisation({ fresh = false } = {}) {
  if (fresh || !customisationPromise) {
    customisationPromise = apiFetch("/api/customisation").catch((err) => {
      customisationPromise = null;
      throw err;
    });
  }
  return customisationPromise;
}

/** @param {import("./core").Fields} fields */
export async function saveCustomisation(fields) {
  const res = await apiFetch("/api/customisation", jsonBody("PUT", fields));
  customisationPromise = Promise.resolve(res);
  return res;
}

/** @param {string} entity @param {string} id @param {import("./core").Fields} values */
export async function setCustomFieldValues(entity, id, values) {
  const res = await apiFetch("/api/custom-fields", jsonBody("PATCH", { entity, id, values }));
  return res.values;
}
