import { NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/lib/timing-safe";
import { supabase } from "@/lib/supabase";
import { writeAdminAuditSafe } from "@/lib/admin/audit";
import { purgeAgencyCandidates, sweepAllAgencies } from "@/lib/data-retention";
import { reportError } from "@/lib/report-error";
import { fetchAll, inChunks } from "@/lib/fetch-all";

// Fulfils the DPA's Annex C promise ("automatic deletion of candidate and
// CV data 90 days after an agency's subscription is cancelled") - until
// this route existed, nothing in the codebase actually did that.
//
// Vercel Cron calls this on the schedule in vercel.json and sends
// `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is
// set (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Checked with a timing-safe comparison, same pattern as
// app/api/internal/edge-log. Fails closed: no secret configured means every
// request is rejected, never silently trusted.
const RETENTION_DAYS = 90;

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!expected) {
    reportError("[data-retention] CRON_SECRET is not set - refusing to run.");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!timingSafeEqualStr(expected, provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 1. Every agency: erase candidates inactive past the agency's retention
  //    period, and lapse expired talent pool entries (lib/data-retention.js).
  let inactivity = null;
  try {
    inactivity = await sweepAllAgencies(supabase);
    if (inactivity.erased || inactivity.expired) {
      await writeAdminAuditSafe({
        adminUsername: "system:data-retention-cron",
        action: "retention_inactivity_sweep",
        targetType: "system",
        targetId: "all",
        metadata: inactivity,
      });
    }
  } catch (err) {
    reportError("[data-retention] Inactivity sweep failed:", err.message);
  }

  // 1b. Research feedback older than 24 months (storage limitation, UK
  //     GDPR Art. 5(1)(e)).
  try {
    const before = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("research_signals").delete().lt("created_at", before);
    if (error) throw new Error(error.message);
  } catch (err) {
    reportError("[data-retention] Research signal sweep failed:", err.message);
  }

  // 2. Agencies cancelled 90+ days ago: erase everything (DPA Annex C).
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // subscriptions has no dedicated cancelled_at column (verified against the
  // live schema) - updated_at is written by the Stripe webhook (app/api/
  // webhooks/stripe) at the exact moment status transitions, so for a row
  // that's been sitting at status="canceled" it doubles as the cancellation
  // timestamp.
  const { data: cancelled, error: subsError } = await fetchAll((from, to) =>
    supabase
      .from("subscriptions")
      .select("user_id, updated_at")
      .eq("status", "canceled")
      .lt("updated_at", cutoff)
      .order("user_id")
      .range(from, to),
  );

  if (subsError) {
    reportError("[data-retention] Failed to query subscriptions:", subsError.message);
    return NextResponse.json({ error: "Failed to query subscriptions" }, { status: 500 });
  }

  if (!cancelled || cancelled.length === 0) {
    return NextResponse.json({ ok: true, agenciesPurged: 0, candidatesPurged: 0, inactivity });
  }

  // subscriptions.user_id points at profiles.id (see lib/customer-auth.js
  // and app/api/billing), not a separate "users" table.
  const profileIds = [...new Set(cancelled.map((s) => s.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = await inChunks(profileIds, (chunk) =>
    supabase.from("profiles").select("id, agency_id").in("id", chunk),
  );

  if (profilesError) {
    reportError("[data-retention] Failed to resolve agencies:", profilesError.message);
    return NextResponse.json({ error: "Failed to resolve agencies" }, { status: 500 });
  }

  const agencyIds = [...new Set((profiles || []).map((p) => p.agency_id).filter(Boolean))];

  let agenciesPurged = 0;
  let candidatesPurged = 0;

  for (const agencyId of agencyIds) {
    // Safety net: an agency can have more than one profile (team seats).
    // Skip it if ANY of its profiles has a subscription that isn't
    // cancelled - better to under-delete on a stale read than erase live
    // customer data because one seat's subscription lapsed while another's
    // is still active.
    // A failed read is treated as "live" for the same reason.
    const { data: agencyProfiles, error: agencyProfilesError } = await supabase.from("profiles").select("id").eq("agency_id", agencyId);
    if (agencyProfilesError) continue;
    const agencyProfileIds = (agencyProfiles || []).map((p) => p.id);
    const { data: liveSubs, error: liveSubsError } = await inChunks(agencyProfileIds, (chunk) =>
      supabase.from("subscriptions").select("id").in("user_id", chunk).neq("status", "canceled"),
    );

    if (liveSubsError || (liveSubs && liveSubs.length > 0)) continue;

    // The same batched, error-checked erasure as a manual delete
    // (lib/candidates/erasure.js via purgeAgencyCandidates). Only what was
    // actually erased is counted and logged.
    const { erased, failedStep } = await purgeAgencyCandidates(supabase, agencyId);
    if (failedStep) reportError(`[data-retention] Purge of agency ${agencyId} stopped at ${failedStep} after ${erased} candidates.`);
    if (!erased) continue;

    agenciesPurged += 1;
    candidatesPurged += erased;

    await writeAdminAuditSafe({
      adminUsername: "system:data-retention-cron",
      action: "retention_purge",
      targetType: "agency",
      targetId: agencyId,
      metadata: { candidatesPurged: erased, retentionDays: RETENTION_DAYS, ...(failedStep ? { incomplete: failedStep } : {}) },
    });
  }

  return NextResponse.json({ ok: true, agenciesPurged, candidatesPurged, inactivity });
}
