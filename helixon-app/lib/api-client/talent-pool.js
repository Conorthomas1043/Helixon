"use client";

// Dashboard API calls: talent pool (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

// Talent pool - see app/api/talent-pool and app/api/candidates/[id]/talent-pool.
export async function getTalentPool({ jobId = "" } = {}) {
  return apiFetch(`/api/talent-pool${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`);
}

// fields: { note?, status?: "available" | "open" | "not_looking" | null, checkIn?: "YYYY-MM-DD" | null }
export async function updateTalentPoolEntry(id, fields) {
  return (
    await apiFetch(`/api/candidates/${id}/talent-pool`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
  ).talentPool;
}

export async function saveToTalentPool(id, note = "") {
  return (
    await apiFetch(`/api/candidates/${id}/talent-pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })
  ).talentPool;
}

export async function removeFromTalentPool(id) {
  // keepalive: an undoable removal may be sent as the page closes.
  return apiFetch(`/api/candidates/${id}/talent-pool`, { method: "DELETE", keepalive: true });
}

// Screens someone already on file against another job, reusing their CV.
// Resolves { candidateId, score, recommendation, job }; a 409 means they're
// already screened for it (err.existingId).
export async function rescreenCandidate(id, jobId) {
  const res = await fetch(`/api/candidates/${id}/rescreen`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || "Couldn't screen this candidate.");
    err.status = res.status;
    err.existingId = data?.existingId || null;
    throw err;
  }
  return data;
}
