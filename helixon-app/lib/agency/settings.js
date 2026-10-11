// Writes to agencies.settings, the JSON object every workspace settings
// page keeps its section in. Reading the whole object, changing one key and
// writing it all back lost one change whenever two pages saved at once, so
// this merges just the given top-level keys in one statement
// (merge_agency_settings, migration 20261010000000).

import "server-only";
import { reportError } from "@/lib/report-error";

/**
 * Replaces the top-level keys in `patch`, leaving every other key alone.
 * Falls back to read-modify-write while the database function doesn't
 * exist yet.
 * @param {any} supabase
 * @param {string} agencyId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<{ error: any }>}
 */
export async function mergeAgencySettings(supabase, agencyId, patch) {
  const { error } = await supabase.rpc("merge_agency_settings", { p_agency: agencyId, p_patch: patch });
  if (!error) return { error: null };
  if (error.code !== "PGRST202" && error.code !== "42883") return { error };

  reportError("[agency-settings] merge_agency_settings is missing - run migration 20261010000000.");
  const { data, error: readError } = await supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle();
  if (readError) return { error: readError };
  const current = data?.settings && typeof data.settings === "object" ? data.settings : {};
  const { error: writeError } = await supabase.from("agencies").update({ settings: { ...current, ...patch } }).eq("id", agencyId);
  return { error: writeError };
}
