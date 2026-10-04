import { NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/lib/timing-safe";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { writeAdminAuditSafe } from "@/lib/admin/audit";
import { getServicesSnapshot } from "@/lib/ops/live-services";
import { getFullHealthChecksSnapshot } from "@/lib/ops/health-checks";
import { HEALTH_CHECKS, OVERALL_LABEL, gradeHealth } from "@/lib/ops/health-grade";
import { alertRecipients, getSiteSettings } from "@/lib/site-settings";
import { escapeHtml, sendAdminAlert } from "@/lib/security/alert-email";
import { reportError } from "@/lib/report-error";

// Once a day (vercel.json), the admin console's time-based controls:
//   1. lift bans whose end date has passed (public.timed_bans)
//   2. end demo access past its demo_expires_at (access already stopped at
//      the end date - lib/subscription-status.js - this marks the row
//      cancelled so Billing and Agencies show it correctly)
//   3. delete IP blocks and firewall rules that expired over a week ago
//   4. run the health checks and email the alert recipients if anything is
//      down (Admin > Security > Who gets alerts)
//   5. clear full request detail older than the retention set on the
//      Traffic page: headers always; query strings and blocked-request
//      bodies too, unless the request was flagged as an attack
// Each step is independent: one failing doesn't stop the rest.
//
// Daily because that's the most a Hobby-plan Vercel cron can run. Same
// Bearer CRON_SECRET check as app/api/cron/data-retention; fails closed.

const SYSTEM = "system:admin-daily";
const TIDY_AFTER_DAYS = 7;

async function liftExpiredBans(nowIso) {
  const { data: due, error } = await supabase.from("timed_bans").select("user_id,until").lte("until", nowIso).limit(200);
  if (error) throw new Error(error.message);
  let lifted = 0;
  const client = due?.some((b) => b.user_id.startsWith("user_")) ? await clerkClient() : null;
  for (const ban of due || []) {
    try {
      // Supabase Auth (legacy) bans carry their own duration and end by
      // themselves; Clerk bans have to be lifted.
      if (ban.user_id.startsWith("user_")) {
        await client.users.unbanUser(ban.user_id);
        await client.users.updateUserMetadata(ban.user_id, { privateMetadata: { ban_reason: null, banned_by: null, banned_at: null } });
      }
      await supabase.from("timed_bans").delete().eq("user_id", ban.user_id);
      lifted += 1;
      await writeAdminAuditSafe({
        adminUsername: SYSTEM,
        action: "user_unban",
        targetType: ban.user_id.startsWith("user_") ? "clerk_user" : "auth_user",
        targetId: ban.user_id,
        metadata: { reason: "Ban period ended", until: ban.until },
      });
    } catch (err) {
      // The account was deleted since - nothing left to unban.
      if (err?.status === 404) await supabase.from("timed_bans").delete().eq("user_id", ban.user_id);
      else reportError("[admin-daily] Couldn't lift ban", ban.user_id, err?.message || err);
    }
  }
  return lifted;
}

async function endExpiredDemos(nowIso) {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: nowIso })
    .eq("status", "active")
    .is("stripe_subscription_id", null)
    .lte("demo_expires_at", nowIso)
    .select("id,user_id");
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    await writeAdminAuditSafe({
      adminUsername: SYSTEM,
      action: "user_revoke_demo_access",
      targetType: "subscription",
      targetId: row.id,
      metadata: { reason: "Demo period ended", profileId: row.user_id },
    });
  }
  return (data || []).length;
}

async function tidyExpiredRules(now) {
  const cutoff = new Date(now - TIDY_AFTER_DAYS * 86400e3).toISOString();
  const [blocks, rules] = await Promise.all([
    supabase.from("blocked_ips").delete().lte("expires_at", cutoff).select("ip"),
    supabase.from("firewall_rules").delete().lte("expires_at", cutoff).select("id"),
  ]);
  return { blocks: blocks.data?.length || 0, rules: rules.data?.length || 0 };
}

async function pruneRequestDetail(settings, now) {
  const days = settings.traffic?.detailDays || 14;
  const cutoff = new Date(now - days * 86400e3).toISOString();
  const [headers, rest] = await Promise.all([
    supabase.from("request_logs").update({ headers: null }, { count: "exact" }).lt("ts", cutoff).not("headers", "is", null),
    supabase
      .from("request_logs")
      .update({ query: null, payload: null }, { count: "exact" })
      .lt("ts", cutoff)
      .lt("threat_score", 20)
      .or("query.not.is.null,payload.not.is.null"),
  ]);
  if (headers.error) throw new Error(headers.error.message);
  if (rest.error) throw new Error(rest.error.message);
  return { days, headersCleared: headers.count || 0, detailCleared: rest.count || 0 };
}

// Deletes request log lines older than the retention the admin chose on
// Traffic (30-90 days, as the privacy policy says), a batch at a time so
// one run never holds a long lock. Anything left over goes tomorrow.
const PRUNE_BATCH = 5000;
const PRUNE_MAX_BATCHES = 40;

async function pruneRequestLogs(settings, now) {
  const days = settings.traffic?.retentionDays || 90;
  const cutoff = new Date(now - days * 86400e3).toISOString();
  let deleted = 0;
  for (let i = 0; i < PRUNE_MAX_BATCHES; i++) {
    const { data, error } = await supabase.rpc("prune_request_logs", { p_before: cutoff, p_batch: PRUNE_BATCH });
    if (error) throw new Error(error.message);
    deleted += Number(data) || 0;
    if ((Number(data) || 0) < PRUNE_BATCH) break;
  }
  // Raised alerts go with the logs they describe.
  await supabase.from("traffic_alerts").delete().lt("created_at", cutoff);
  return { days, deleted };
}

async function dailyHealthCheck(settings) {
  const [services, checks] = await Promise.all([getServicesSnapshot(), getFullHealthChecksSnapshot()]);
  const grade = gradeHealth({ ...services, ...checks }, settings.health?.muted || []);
  await supabase.from("admin_health_snapshots").insert({ overall: grade.overall, failing: grade.failing, checked_by: SYSTEM });

  const to = alertRecipients(settings);
  let emailed = false;
  if (grade.overall !== "ok" && settings.alerts?.healthDigest !== false && to.length) {
    const labels = grade.failing.map((k) => HEALTH_CHECKS.find((c) => c.key === k)?.label || k);
    emailed = await sendAdminAlert({
      to,
      subject: `Helixon health: ${grade.overall} - ${labels.join(", ")}`,
      html: `
        <h2>${escapeHtml(OVERALL_LABEL[grade.overall])}</h2>
        <p>The daily health check found a problem with: <strong>${escapeHtml(labels.join(", "))}</strong>.</p>
        <p>Open System health in the admin console for details. You get this because you're listed under Security &gt; Who gets alerts.</p>
      `,
    });
  }
  return { overall: grade.overall, failing: grade.failing, emailed };
}

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected) {
    reportError("[admin-daily] CRON_SECRET is not set - refusing to run.");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!timingSafeEqualStr(expected, provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const result = {};
  const step = async (name, fn) => {
    try {
      result[name] = await fn();
    } catch (err) {
      reportError(`[admin-daily] ${name} failed:`, err?.message || err);
      result[name] = { error: true };
    }
  };

  const settings = await getSiteSettings({ fresh: true });
  await step("bansLifted", () => liftExpiredBans(nowIso));
  await step("demosEnded", () => endExpiredDemos(nowIso));
  await step("tidied", () => tidyExpiredRules(now));
  await step("health", () => dailyHealthCheck(settings));
  await step("requestDetail", () => pruneRequestDetail(settings, now));
  await step("requestLogs", () => pruneRequestLogs(settings, now));

  return NextResponse.json({ ok: true, ...result });
}
