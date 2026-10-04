"use client";

// Dashboard API calls: tags (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

export async function getTags() {
  return (await apiFetch("/api/tags")).tags;
}

export async function createTag(label) {
  return (
    await apiFetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    })
  ).tag;
}

export async function deleteTag(id) {
  return apiFetch(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagId }),
  });
}

export async function removeCandidateTag(id, tagId) {
  return apiFetch(`/api/candidates/${id}/tags/${tagId}`, { method: "DELETE" });
}
