import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { DEFAULT_TIME_ZONE, followUpItems, interviewFollowUpItems } from "@/lib/follow-ups";
import { buildReminderEmail, remindersEnabled } from "@/lib/reminder-email";

// Weekday-morning follow-up reminders: each recruiter gets one email
// listing the next actions and talent-pool check-ins that are overdue or due
// today on candidates assigned to them (lib/follow-ups.js,
// lib/reminder-email.js). Unassigned candidates have nobody to remind;
// anyone who turned reminders off (Account > Notifications) or is no longer
// in the candidate's agency is skipped, as are suspended workspaces.
//
// Called by Vercel Cron (vercel.json) with `Authorization: Bearer
// <CRON_SECRET>` - same fail-closed check as app/api/cron/data-retention.

const PAGE = 1000;
const ROW_CAP = 20000;
const CLERK_BATCH = 100;
const SEND_BATCH = 100;

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function fetchFollowUpRows() {
  let rows = [];
  for (let from = 0; from < ROW_CAP; from += PAGE) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, agency_id, full_name, name, recruiter_id, next_action, talent_pool_at, talent_pool_check_in, jobs(title)")
      .not("recruiter_id", "is", null)
      .or("next_action.not.is.null,talent_pool_check_in.not.is.null")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqualStr(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ ok: false, error: "Email isn't configured." }, { status: 503 });
  }

  const now = new Date();
  let rows;
  let interviewRows;
  let suspended;
  try {
    const [candidateRows, { data: suspendedRows, error }, { data: ivs, error: ivError }] = await Promise.all([
      fetchFollowUpRows(),
      supabase.from("agencies").select("id").not("suspended_at", "is", null),
      // Today's interviews and ones that happened without an outcome.
      supabase
        .from("interviews")
        .select("id, agency_id, candidate_id, round, status, starts_at, duration_minutes, candidates(full_name, name, recruiter_id), jobs(title)")
        .eq("status", "scheduled")
        .lte("starts_at", new Date(now.getTime() + 86400000).toISOString())
        .gte("starts_at", new Date(now.getTime() - 30 * 86400000).toISOString())
        .limit(ROW_CAP),
    ]);
    if (error) throw new Error(error.message);
    if (ivError) throw new Error(ivError.message);
    rows = candidateRows;
    interviewRows = (ivs ?? []).map((r) => ({ ...r, recruiter_id: r.candidates?.recruiter_id ?? null })).filter((r) => r.recruiter_id);
    suspended = new Set((suspendedRows ?? []).map((a) => a.id));
  } catch (err) {
    console.error("[cron/reminders] Query failed:", err.message);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }

  // Only remind people who are still members of the candidate's agency -
  // recruiter_id outlives someone leaving (or being moved to another
  // workspace), and their old agency's candidates must not follow them.
  const memberAgency = new Map();
  const assigned = [...new Set([...rows, ...interviewRows].map((r) => r.recruiter_id))];
  for (let i = 0; i < assigned.length; i += CLERK_BATCH) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("clerk_user_id, agency_id")
      .in("clerk_user_id", assigned.slice(i, i + CLERK_BATCH));
    if (error) {
      console.error("[cron/reminders] Profile lookup failed:", error.message);
      return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
    }
    for (const p of profiles ?? []) memberAgency.set(p.clerk_user_id, p.agency_id);
  }
  const isEligible = (r) => !suspended.has(r.agency_id) && memberAgency.get(r.recruiter_id) === r.agency_id;

  // Due items, grouped by the recruiter they're assigned to.
  const byRecruiter = new Map();
  const due = [
    ...followUpItems(rows.filter(isEligible), now, DEFAULT_TIME_ZONE),
    ...interviewFollowUpItems(interviewRows.filter(isEligible), now, DEFAULT_TIME_ZONE),
  ];
  for (const item of due) {
    if (item.when !== "overdue" && item.when !== "today") continue;
    if (!byRecruiter.has(item.recruiterId)) byRecruiter.set(item.recruiterId, []);
    byRecruiter.get(item.recruiterId).push(item);
  }

  const recruiterIds = [...byRecruiter.keys()];
  const users = new Map();
  if (recruiterIds.length) {
    const client = await clerkClient();
    for (let i = 0; i < recruiterIds.length; i += CLERK_BATCH) {
      const { data } = await client.users.getUserList({ userId: recruiterIds.slice(i, i + CLERK_BATCH), limit: CLERK_BATCH });
      for (const u of data ?? []) users.set(u.id, u);
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  const from = `Helixon <${process.env.RESEND_FROM_EMAIL}>`;
  const emails = [];
  let optedOut = 0;
  let noAddress = 0;
  for (const [recruiterId, items] of byRecruiter) {
    const user = users.get(recruiterId);
    const to = user?.primaryEmailAddress?.emailAddress;
    if (!to) {
      noAddress += 1;
      continue;
    }
    if (!remindersEnabled(user.privateMetadata)) {
      optedOut += 1;
      continue;
    }
    const email = buildReminderEmail({ firstName: user.firstName, items, siteUrl, timeZone: DEFAULT_TIME_ZONE });
    if (email) emails.push({ from, to, subject: email.subject, html: email.html, text: email.text });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += SEND_BATCH) {
    const batch = emails.slice(i, i + SEND_BATCH);
    const { error } = await resend.batch.send(batch);
    if (error) {
      failed += batch.length;
      console.error("[cron/reminders] Send failed:", error.message);
    } else {
      sent += batch.length;
    }
  }

  return NextResponse.json({ ok: failed === 0, recruiters: byRecruiter.size, sent, failed, optedOut, noAddress, truncated: rows.length >= ROW_CAP });
}
