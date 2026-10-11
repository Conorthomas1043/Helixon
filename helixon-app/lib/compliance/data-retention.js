// Storage limitation for agencies that are still subscribed (GDPR Art.
// 5(1)(e)): candidates nobody has touched for the agency's retention period
// (lib/compliance/privacy-settings.js, 12 months by default) are erased, and talent
// pool entries lapse when their expiry passes unless someone extends them.
// Run daily by app/api/cron/data-retention, alongside the post-cancellation
// purge. /dashboard/privacy shows what's coming up so an agency can keep
// someone on purpose.

import { eraseCandidates } from "@/lib/candidates/erasure";
import { getAgencyPrivacy, retentionCutoff, RETENTION_WARNING_DAYS, addMonths } from "@/lib/compliance/privacy-settings";
import { reportError } from "@/lib/report-error";

const MAX_PER_AGENCY_PER_RUN = 2000;

// Candidates past the cutoff and not held in the talent pool.
function inactiveQuery(supabase, agencyId, cutoffIso) {
  return supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .is("talent_pool_at", null)
    .or(`last_activity_at.lt.${cutoffIso},and(last_activity_at.is.null,created_at.lt.${cutoffIso})`);
}

// Takes lapsed entries out of the pool. They're then treated like anyone
// else: kept while there's recent activity, erased once there isn't.
export async function expireTalentPool(supabase, agencyId, now = new Date()) {
  const { data, error } = await supabase
    .from("candidates")
    .update({ talent_pool_at: null, talent_pool_by: null, talent_pool_note: null, talent_pool_status: null, talent_pool_check_in: null, talent_pool_expires_at: null })
    .eq("agency_id", agencyId)
    .lt("talent_pool_expires_at", now.toISOString())
    .select("id");
  if (error) throw new Error(error.message);
  if (data?.length) {
    await supabase
      .from("candidate_activity")
      .insert(data.map((r) => ({ candidate_id: r.id, type: "talent_pool_expired", actor: "Retention policy" })));
  }
  return data?.length || 0;
}

export async function sweepAgency(supabase, agencyId, now = new Date()) {
  const { retentionMonths } = await getAgencyPrivacy(supabase, agencyId);
  const expired = await expireTalentPool(supabase, agencyId, now);
  const cutoff = retentionCutoff(retentionMonths, now).toISOString();
  const { data, error } = await inactiveQuery(supabase, agencyId, cutoff).limit(MAX_PER_AGENCY_PER_RUN);
  if (error) throw new Error(error.message);
  const ids = (data || []).map((r) => r.id);
  let erased = 0;
  if (ids.length) {
    const result = await eraseCandidates(supabase, agencyId, ids);
    if (result.failedStep) throw new Error(`erasure stopped at ${result.failedStep}`);
    erased = result.erased;
  }
  return { retentionMonths, expired, erased };
}

const AGENCY_PAGE = 1000;

// Every agency id, a page at a time (a plain select stops at the database's
// 1,000-row limit, which would leave every later agency unswept).
async function allAgencyIds(supabase) {
  const ids = [];
  for (let from = 0; ; from += AGENCY_PAGE) {
    const { data, error } = await supabase.from("agencies").select("id").order("id").range(from, from + AGENCY_PAGE - 1);
    if (error) throw new Error(error.message);
    ids.push(...(data || []).map((a) => a.id));
    if (!data || data.length < AGENCY_PAGE) return ids;
  }
}

export async function sweepAllAgencies(supabase, now = new Date()) {
  const agencies = (await allAgencyIds(supabase)).map((id) => ({ id }));
  const summary = { agencies: 0, erased: 0, expired: 0, failed: [] };
  for (const a of agencies) {
    try {
      const r = await sweepAgency(supabase, a.id, now);
      summary.agencies += 1;
      summary.erased += r.erased;
      summary.expired += r.expired;
    } catch (err) {
      reportError(`[data-retention] Sweep failed for agency ${a.id}:`, err.message);
      summary.failed.push(a.id);
    }
  }
  return summary;
}

// What the Data & privacy page shows: who will be erased, and whose pool
// entry will lapse, within the warning window.
export async function upcomingRetention(supabase, agencyId, now = new Date()) {
  const { retentionMonths } = await getAgencyPrivacy(supabase, agencyId);
  const warnCutoff = retentionCutoff(retentionMonths, new Date(now.getTime() + RETENTION_WARNING_DAYS * 86400000)).toISOString();
  const soon = new Date(now.getTime() + RETENTION_WARNING_DAYS * 86400000).toISOString();

  const [{ data: dueRows, error: dueError }, { data: poolRows, error: poolError }] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, name, last_activity_at, created_at, stage, jobs(title)")
      .eq("agency_id", agencyId)
      .is("talent_pool_at", null)
      .or(`last_activity_at.lt.${warnCutoff},and(last_activity_at.is.null,created_at.lt.${warnCutoff})`)
      .order("last_activity_at", { ascending: true, nullsFirst: true })
      .limit(200),
    supabase
      .from("candidates")
      .select("id, full_name, name, talent_pool_expires_at")
      .eq("agency_id", agencyId)
      .not("talent_pool_at", "is", null)
      .lt("talent_pool_expires_at", soon)
      .order("talent_pool_expires_at", { ascending: true })
      .limit(200),
  ]);
  if (dueError || poolError) throw new Error((dueError || poolError).message);

  return {
    retentionMonths,
    deletions: (dueRows || []).map((r) => {
      const last = r.last_activity_at || r.created_at;
      return {
        id: r.id,
        name: r.full_name || r.name || "Unnamed candidate",
        jobTitle: r.jobs?.title || null,
        stage: r.stage,
        lastActiveAt: last,
        deletesOn: addMonths(new Date(last), retentionMonths).toISOString(),
      };
    }),
    poolExpiries: (poolRows || []).map((r) => ({ id: r.id, name: r.full_name || r.name || "Unnamed candidate", expiresAt: r.talent_pool_expires_at })),
  };
}

// Erases every candidate of an agency whose subscription ended long enough
// ago (the DPA's post-cancellation deletion - app/api/cron/data-retention),
// through the same batched, error-checked erasure as a manual delete, a
// thousand at a time up to `maxRounds` per run (the rest goes on the next
// run). Returns { erased, failedStep? } - erased is what was actually
// deleted, never what was attempted.
export async function purgeAgencyCandidates(supabase, agencyId, { maxRounds = 20 } = {}) {
  let erased = 0;
  for (let round = 0; round < maxRounds; round++) {
    const { data, error } = await supabase.from("candidates").select("id").eq("agency_id", agencyId).limit(1000);
    if (error) return { erased, failedStep: "lookup" };
    const ids = (data || []).map((r) => r.id);
    if (!ids.length) break;
    const result = await eraseCandidates(supabase, agencyId, ids);
    erased += result.erased;
    if (result.failedStep) return { erased, failedStep: result.failedStep };
    if (!result.erased) break;
  }
  return { erased };
}
