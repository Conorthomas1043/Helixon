// Workspace permissions (agencies.settings.permissions), set by the owner or
// an admin on /dashboard/settings/permissions:
//
//   financialsAdminOnly   fees, salaries, rates, invoices and commission are
//                         only shown to the owner and admins
//   ownCandidatesOnly     members only see candidates assigned to them (and
//                         unassigned ones); admins see everyone's
//
// Owners and admins (lib/workspace-admin.js) are never restricted.

import "server-only";
import { supabase } from "@/lib/supabase";
import { canManageWorkspace } from "@/lib/workspace-admin";

export const PERMISSION_KEYS = {
  financialsAdminOnly: "Only the owner and admins see fees, salaries, rates, invoices and commission",
  ownCandidatesOnly: "Members only see candidates assigned to them (and unassigned ones)",
};

export function normalisePermissions(settings) {
  const p = settings?.permissions || {};
  return { financialsAdminOnly: p.financialsAdminOnly === true, ownCandidatesOnly: p.ownCandidatesOnly === true };
}

export function cleanPermissions(body = {}) {
  const out = {};
  for (const key of Object.keys(PERMISSION_KEYS)) if (typeof body[key] === "boolean") out[key] = body[key];
  return out;
}

// What this signed-in member may see. Memoised on the auth object so a
// route asking twice costs one lookup.
export async function getAccess(auth) {
  if (auth.__access) return auth.__access;
  const { data: agency } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const perms = normalisePermissions(agency?.settings);
  // Who's an admin only matters when a restriction is on - and finding out
  // asks Clerk, so most workspaces (no restrictions) never pay for it.
  const restricted = perms.financialsAdminOnly || perms.ownCandidatesOnly;
  const isAdmin = restricted ? await canManageWorkspace(auth) : null;
  const access = {
    isAdmin,
    permissions: perms,
    canSeeFinancials: isAdmin || !perms.financialsAdminOnly,
    seesAllCandidates: isAdmin || !perms.ownCandidatesOnly,
  };
  auth.__access = access;
  return access;
}

// Whether a candidate row (with recruiter_id) is visible to this member.
export function canSeeCandidate(access, auth, candidate) {
  if (access.seesAllCandidates) return true;
  return !candidate?.recruiter_id || candidate.recruiter_id === auth.userId;
}

// Applies "own candidates only" to a candidates query.
export function scopeCandidateQuery(query, access, auth, column = "recruiter_id") {
  if (access.seesAllCandidates) return query;
  return query.or(`${column}.is.null,${column}.eq.${auth.userId}`);
}

// Money fields blanked for members who can't see financials.
export function redactPlacement(p, access) {
  if (access.canSeeFinancials) return p;
  return { ...p, salary: null, feePercent: null, feeAmount: null, payRate: null, chargeRate: null, invoices: [], financialsHidden: true };
}

// Job rows (database column names) with the agreed fee blanked likewise.
export function redactJob(job, access) {
  if (access.canSeeFinancials || !job) return job;
  return { ...job, fee_percent: null, fee_amount: null, financialsHidden: true };
}

// The keys of `update` a member who can't see financials may still write:
// money columns are dropped rather than refused, because the edit forms send
// every field back, including the blanked ones.
export function withoutMoney(update, access, columns) {
  if (access.canSeeFinancials) return update;
  const out = { ...update };
  for (const c of columns) delete out[c];
  return out;
}

// A placement request body without the money a member who can't see
// financials isn't allowed to set (the placement form leaves these out for
// them too - components/dashboard/placements.jsx).
const PLACEMENT_MONEY_KEYS = ["salary", "feePercent", "feeAmount", "payRate", "chargeRate", "splits"];
export function placementInputFor(body, access) {
  if (access.canSeeFinancials || !body) return body;
  const out = { ...body };
  for (const k of PLACEMENT_MONEY_KEYS) delete out[k];
  return out;
}

// For candidate routes: a 404 response when "own candidates only" hides
// this candidate from the signed-in member, otherwise null. Shaped like
// the routes' own "Not found" so a hidden candidate looks like no candidate.
export async function candidateHidden(auth, rawId) {
  const access = await getAccess(auth);
  if (access.seesAllCandidates) return null;
  const { data } = await supabase.from("candidates").select("recruiter_id").eq("id", rawId).eq("agency_id", auth.agencyId).maybeSingle();
  if (!data || canSeeCandidate(access, auth, data)) return null;
  const { NextResponse } = await import("next/server");
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
