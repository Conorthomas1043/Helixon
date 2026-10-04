"use client";

// Dashboard API calls: team (re-exported by lib/dashboard-api.js).

import { track } from "@/lib/analytics";
import { apiFetch } from "./core";

export async function getRecruiters() {
  return apiFetch("/api/team");
}

// Unlike apiFetch, this doesn't throw on a non-2xx - the caller needs to
// tell "403, you're not on the Agency plan" (hide the invite UI entirely)
// apart from a real failure (show an error state), which a thrown Error
// with just a message string can't distinguish reliably.
export async function getTeamSeatUsage() {
  const res = await fetch("/api/team/invite", { credentials: "include" });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export async function inviteTeammate(email) {
  const result = await apiFetch("/api/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  track("teammate_invited");
  return result;
}

export async function cancelTeamInvite(invitationId) {
  return apiFetch("/api/team/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitationId }),
  });
}

// Removes an existing (already-accepted) team member, freeing their seat.
// Same endpoint as cancelTeamInvite, distinguished by { userId } instead of
// { invitationId } - see app/api/team/invite's DELETE handler. reassignTo:
// a remaining member's id to take over their candidates, null to leave them
// unassigned, or undefined to leave them as they are.
export async function removeTeammate(userId, reassignTo) {
  return apiFetch("/api/team/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reassignTo === undefined ? { userId } : { userId, reassignTo }),
  });
}

// Your own presence on the Team page: status "busy" | "away" | null
// (automatic), with an optional message and end time (ISO).
export async function setMyPresence({ status = null, message = "", until = null } = {}) {
  return apiFetch("/api/team/presence", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, message, until }),
  });
}

// Data & privacy (/dashboard/privacy, app/api/privacy).
export async function getPrivacyOverview() {
  return apiFetch("/api/privacy");
}

export async function updatePrivacySettings(fields) {
  return apiFetch("/api/privacy", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function keepCandidates(ids) {
  return apiFetch("/api/privacy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "keep", ids }),
  });
}

// Stop (true) or start (false) sharing your presence; stopping deletes
// what's been recorded.
export async function setPresenceHidden(hidden) {
  return apiFetch("/api/team/presence", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hidden }),
  });
}

// role: "admin" (can manage the team) or "member".
export async function setTeammateRole(userId, role) {
  return apiFetch("/api/team/role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role }),
  });
}

// Hands every candidate no current member owns to one team member.
export async function assignUnassignedCandidates(toUserId) {
  return apiFetch("/api/team/invite", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reassignUnassignedTo: toUserId }),
  });
}
