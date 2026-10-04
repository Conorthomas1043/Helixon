// lib/agency-controls.js
// Admin-set controls on a customer workspace (Admin > Agencies):
//   suspended_at / suspended_reason  every agency-scoped API refuses its members
//   screening_cap                    optional monthly limit on CV screenings
// Read on customer requests, so failures fail open: a lookup error must
// never lock a paying customer out.

import "server-only";
import { supabase } from "@/lib/supabase";

export const SUSPENDED_MESSAGE =
  "This workspace has been suspended. Please contact Helixon support at hello@helixon.co.uk.";

export async function getAgencyControls(agencyId) {
  if (!agencyId) return { suspended: false, screeningCap: null };
  const { data, error } = await supabase
    .from("agencies")
    .select("suspended_at,screening_cap")
    .eq("id", agencyId)
    .maybeSingle();
  if (error) {
    // 42703: before migration 20260929030000.
    if (error.code !== "42703") console.error("[agency-controls] lookup failed:", error.message);
    return { suspended: false, screeningCap: null };
  }
  return { suspended: Boolean(data?.suspended_at), screeningCap: data?.screening_cap || null };
}

export function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Screenings (candidates created) this calendar month, UTC. */
export async function screeningsThisMonth(agencyId) {
  const { count, error } = await supabase
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .gte("created_at", startOfMonthUtc());
  if (error) {
    console.error("[agency-controls] count failed:", error.message);
    return 0;
  }
  return count || 0;
}

/**
 * null when the agency may screen another CV; otherwise a ready
 * { status, error } for the API to return.
 */
export function capRefusal(used, cap) {
  if (!cap || used < cap) return null;
  return {
    status: 429,
    error: `Your workspace has reached its limit of ${cap} screenings this month. It resets on the 1st - contact Helixon support if you need more.`,
  };
}
