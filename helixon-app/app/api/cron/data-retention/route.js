import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { writeAdminAuditSafe } from "@/lib/admin-audit";

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

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Same dependency order as app/api/candidates/[id]'s DELETE handler
// (feedback and shortlist_candidates reference scores.id with NO ACTION,
// so feedback has to go before scores) - just batched per agency instead
// of one candidate at a time.
async function purgeCandidates(candidateIds) {
  if (candidateIds.length === 0) return;

  const { data: scoreRows } = await supabase.from("scores").select("id").in("candidate_id", candidateIds);
  const scoreIds = (scoreRows || []).map((s) => s.id);
  if (scoreIds.length > 0) {
    await supabase.from("feedback").delete().in("score_id", scoreIds);
  }

  await supabase.from("shortlist_candidates").delete().in("candidate_id", candidateIds);
  await supabase.from("scores").delete().in("candidate_id", candidateIds);
  await supabase.from("artifacts").delete().in("candidate_id", candidateIds);
  await supabase.from("candidate_notes").delete().in("candidate_id", candidateIds);
  await supabase.from("candidates").delete().in("id", candidateIds);
}

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!expected) {
    console.error("[data-retention] CRON_SECRET is not set - refusing to run.");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!timingSafeEqualStr(expected, provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // subscriptions has no dedicated cancelled_at column (verified against the
  // live schema) - updated_at is written by the Stripe webhook (app/api/
  // webhooks/stripe) at the exact moment status transitions, so for a row
  // that's been sitting at status="canceled" it doubles as the cancellation
  // timestamp.
  const { data: cancelled, error: subsError } = await supabase
    .from("subscriptions")
    .select("user_id, updated_at")
    .eq("status", "canceled")
    .lt("updated_at", cutoff);

  if (subsError) {
    console.error("[data-retention] Failed to query subscriptions:", subsError.message);
    return NextResponse.json({ error: "Failed to query subscriptions" }, { status: 500 });
  }

  if (!cancelled || cancelled.length === 0) {
    return NextResponse.json({ ok: true, agenciesPurged: 0, candidatesPurged: 0 });
  }

  // subscriptions.user_id points at profiles.id (see lib/customer-auth.js
  // and app/api/billing), not a separate "users" table.
  const profileIds = [...new Set(cancelled.map((s) => s.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, agency_id")
    .in("id", profileIds);

  if (profilesError) {
    console.error("[data-retention] Failed to resolve agencies:", profilesError.message);
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
    const { data: agencyProfiles } = await supabase.from("profiles").select("id").eq("agency_id", agencyId);
    const agencyProfileIds = (agencyProfiles || []).map((p) => p.id);
    const { data: liveSubs } = await supabase
      .from("subscriptions")
      .select("id")
      .in("user_id", agencyProfileIds)
      .neq("status", "canceled");

    if (liveSubs && liveSubs.length > 0) continue;

    const { data: candidateRows, error: candErr } = await supabase
      .from("candidates")
      .select("id")
      .eq("agency_id", agencyId);

    if (candErr) {
      console.error(`[data-retention] Failed to list candidates for agency ${agencyId}:`, candErr.message);
      continue;
    }

    const candidateIds = (candidateRows || []).map((c) => c.id);
    if (candidateIds.length === 0) continue;

    await purgeCandidates(candidateIds);
    agenciesPurged += 1;
    candidatesPurged += candidateIds.length;

    await writeAdminAuditSafe({
      adminUsername: "system:data-retention-cron",
      action: "retention_purge",
      targetType: "agency",
      targetId: agencyId,
      metadata: { candidatesPurged: candidateIds.length, retentionDays: RETENTION_DAYS },
    });
  }

  return NextResponse.json({ ok: true, agenciesPurged, candidatesPurged });
}
