import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth/cron-auth";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { groupTransitions, inRange, loadActivity, loadCandidates, loadPlacements } from "@/lib/analytics/data";
import { computeCore, furthestStageIndex } from "@/lib/analytics/snapshot";
import { buildDigestEmail, digestEnabled } from "@/lib/analytics/digest";
import { reportError } from "@/lib/report-error";
import { normalisePermissions } from "@/lib/agency/permissions";
import { getOrgMemberRole } from "@/lib/auth/clerk-org";

// Monday-morning analytics summary: last week's headline numbers for the
// agency against the week before (lib/analytics/digest.js), emailed to
// everyone who switched it on in Account > Notifications. Same figures as
// the Analytics page (lib/analytics/data.js, lib/analytics/snapshot.js).
// Suspended workspaces are skipped.
//
// Called by Vercel Cron (vercel.json) with `Authorization: Bearer
// <CRON_SECRET>` - same fail-closed check as app/api/cron/reminders.

const DAY = 86400000;
const PAGE = 1000;
const CLERK_BATCH = 100;
const SEND_BATCH = 100;
const COLUMNS = "id, job_id, created_at, stage, processing_status, match_score, recruiter_id, last_activity_at";

async function allProfiles() {
  let rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("clerk_user_id, agency_id")
      .not("agency_id", "is", null)
      .not("clerk_user_id", "is", null)
      .order("clerk_user_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if (!data || data.length < PAGE) return rows;
  }
}

// One agency's week and the week before, in the digest's shape. With
// `recruiterId`, only that person's candidates - what a member limited to
// their own candidates sees on the Analytics page.
async function agencyWeeks(agencyId, now, recruiterId = null) {
  const week = { from: new Date(now - 7 * DAY), to: new Date(now) };
  const before = { from: new Date(now - 14 * DAY), to: week.from };
  const filters = { jobId: null, recruiterId, range: week };

  const [current, previous, placements] = await Promise.all([
    loadCandidates(agencyId, filters, COLUMNS, { window: week }),
    loadCandidates(agencyId, filters, COLUMNS, { window: before }),
    loadPlacements(agencyId, filters),
  ]);
  const error = current.error || previous.error || placements.error;
  if (error) throw new Error(error.message);

  const { data: activity, error: activityError } = await loadActivity(
    [...current.data, ...previous.data].map((c) => c.id),
    { types: ["stage_changed"] }
  );
  if (activityError) throw new Error(activityError.message);
  const transitions = groupTransitions(activity);
  const furthest = new Map();
  for (const c of [...current.data, ...previous.data]) furthest.set(c.id, furthestStageIndex(c, transitions.get(c.id)));

  const summarise = (rows, range) => {
    const core = computeCore(rows, furthest, now);
    const placed = placements.data.filter((p) => inRange(p.at, range));
    return {
      analysed: core.totals.completed,
      placed: placed.length,
      fees: placed.reduce((sum, p) => sum + (Number.isFinite(p.fee) ? p.fee : 0), 0),
      avgScore: core.quality.avgScore,
      shortlistRate: core.conversion.shortlistRate,
      placementRate: core.conversion.placementRate,
    };
  };
  return { week: summarise(current.data, week), previous: summarise(previous.data, before) };
}

// Stalled is about the whole pipeline now, not just last week's new
// candidates: in a middle stage with nothing logged for 5+ days.
async function stalledCount(agencyId, now, recruiterId = null) {
  let q = supabase
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("stage", ["Shortlisted", "Interview", "Offer"])
    .lt("last_activity_at", new Date(now - 5 * DAY).toISOString());
  if (recruiterId) q = q.eq("recruiter_id", recruiterId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// What one recipient may see under the agency's permissions
// (lib/agency/permissions.js): the owner and admins see everything.
async function recipientAccess(agency, perms, userId) {
  if (!perms.financialsAdminOnly && !perms.ownCandidatesOnly) return { fees: true, recruiterId: null };
  let isAdmin = !agency?.clerk_org_id;
  if (!isAdmin) {
    try {
      isAdmin = (await getOrgMemberRole({ orgId: agency.clerk_org_id, userId })) === "org:admin";
    } catch {
      isAdmin = false;
    }
  }
  return {
    fees: isAdmin || !perms.financialsAdminOnly,
    recruiterId: isAdmin || !perms.ownCandidatesOnly ? null : userId,
  };
}

export async function GET(request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ ok: false, error: "Email isn't configured." }, { status: 503 });
  }

  const now = Date.now();
  let profiles;
  let suspended;
  try {
    const [rows, { data: suspendedRows, error }] = await Promise.all([
      allProfiles(),
      supabase.from("agencies").select("id").not("suspended_at", "is", null),
    ]);
    if (error) throw new Error(error.message);
    profiles = rows;
    suspended = new Set((suspendedRows ?? []).map((a) => a.id));
  } catch (err) {
    reportError("[cron/analytics-digest] Query failed:", err.message);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }

  // Who switched it on - the preference lives on their Clerk user.
  const agencyOf = new Map(profiles.filter((p) => !suspended.has(p.agency_id)).map((p) => [p.clerk_user_id, p.agency_id]));
  const ids = [...agencyOf.keys()];
  const recipientsByAgency = new Map();
  const client = await clerkClient();
  for (let i = 0; i < ids.length; i += CLERK_BATCH) {
    const { data } = await client.users.getUserList({ userId: ids.slice(i, i + CLERK_BATCH), limit: CLERK_BATCH });
    for (const u of data ?? []) {
      const to = u.primaryEmailAddress?.emailAddress;
      if (!to || !digestEnabled(u.privateMetadata)) continue;
      const agencyId = agencyOf.get(u.id);
      if (!recipientsByAgency.has(agencyId)) recipientsByAgency.set(agencyId, []);
      recipientsByAgency.get(agencyId).push({ to, firstName: u.firstName, userId: u.id });
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  const from = `Helixon <${process.env.RESEND_FROM_EMAIL}>`;
  const emails = [];
  let agencyErrors = 0;
  let quiet = 0;
  for (const [agencyId, recipients] of recipientsByAgency) {
    try {
      const { data: agency, error: agencyError } = await supabase.from("agencies").select("name, settings, clerk_org_id").eq("id", agencyId).maybeSingle();
      if (agencyError) throw new Error(agencyError.message);
      const perms = normalisePermissions(agency?.settings);
      // Figures per view: the whole agency, or one member's own candidates.
      const views = new Map();
      const viewFor = (recruiterId) => {
        const key = recruiterId || "";
        if (!views.has(key)) views.set(key, Promise.all([agencyWeeks(agencyId, now, recruiterId), stalledCount(agencyId, now, recruiterId)]));
        return views.get(key);
      };
      for (const r of recipients) {
        const access = await recipientAccess(agency, perms, r.userId);
        const [{ week, previous }, stalled] = await viewFor(access.recruiterId);
        const hideFees = (w) => (w && !access.fees ? { ...w, fees: null } : w);
        const email = buildDigestEmail({
          firstName: r.firstName,
          agencyName: agency?.name || null,
          week: { ...hideFees(week), stalled },
          previous: hideFees(previous),
          siteUrl,
          weekLabel: "the last 7 days",
        });
        if (email) emails.push({ from, to: r.to, subject: email.subject, html: email.html, text: email.text });
        else quiet += 1;
      }
    } catch (err) {
      agencyErrors += 1;
      reportError("[cron/analytics-digest] Agency failed:", agencyId, err.message);
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += SEND_BATCH) {
    const batch = emails.slice(i, i + SEND_BATCH);
    const { error } = await resend.batch.send(batch);
    if (error) {
      failed += batch.length;
      reportError("[cron/analytics-digest] Send failed:", error.message);
    } else {
      sent += batch.length;
    }
  }

  return NextResponse.json({ ok: failed === 0 && agencyErrors === 0, agencies: recipientsByAgency.size, sent, failed, quiet, agencyErrors });
}
