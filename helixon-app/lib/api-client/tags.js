"use client";

// Dashboard API calls: tags (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

export async function getTags() {
  return (await apiFetch("/api/tags")).tags;
}

/** @param {string} label */
export async function createTag(label) {
  return (
    await apiFetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    })
  ).tag;
}

/** @param {string} id */
export async function deleteTag(id) {
  return apiFetch(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** @param {string} id @param {string} tagId */
export async function addCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagId }),
  });
}

/** @param {string} id @param {string} tagId */
export async function removeCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags/${tagId}`, { method: "DELETE" });
}
