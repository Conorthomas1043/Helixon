import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { startOfMonthUtc } from "@/lib/agency-controls";
import { demoExpired } from "@/lib/subscription-status";

// The customer view: one row per agency with the numbers that answer "who is
// using Helixon, on what plan, and how much?", plus the admin controls on a
// workspace (PATCH): rename, suspend/reactivate, a monthly screening cap,
// and removing a member. Every change is audited.
//
// Counts come from admin_agency_counts() (migration 20260929030000). Until
// that's applied they're tallied in JavaScript from capped row pulls, as
// before, and flagged as truncated when a cap is hit.

const ROW_CAP = 20000;
const DAY = 24 * 60 * 60 * 1000;

function tally(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const k = row[key];
    if (k) map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

function latest(rows, key, dateKey) {
  const map = new Map();
  for (const row of rows || []) {
    const k = row[key];
    const t = row[dateKey] ? Date.parse(row[dateKey]) : 0;
    if (k && t > (map.get(k) || 0)) map.set(k, t);
  }
  return map;
}

export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    const detailId = searchParams.get("id");
    if (detailId) return await detail(supabase, cleanUuid(detailId));

    const search = cleanLine(searchParams.get("search"), 80).toLowerCase();

    const agencyQuery = (columns) =>
      supabase.from("agencies").select(columns).order("created_at", { ascending: false }).limit(2000);
    const [agencies, profiles, subscriptions, counts] = await Promise.all([
      agencyQuery("id,name,created_at,plan_name,analyses_limit,analyses_used,intake_email,clerk_org_id,settings,suspended_at,screening_cap"),
      supabase.from("profiles").select("id,agency_id").limit(ROW_CAP),
      supabase.from("subscriptions").select("user_id,plan,status,stripe_subscription_id,updated_at,demo_expires_at").limit(ROW_CAP),
      supabase.rpc("admin_agency_counts"),
    ]);

    for (const result of [agencies, profiles, subscriptions]) {
      if (result.error) return adminDbError("agencies", result.error);
    }

    let memberCount, candidateCount, jobCount, monthCount, lastActivityOf;
    let truncated = false;
    if (!counts.error) {
      const byAgency = new Map((counts.data || []).map((c) => [c.agency_id, c]));
      const num = (id, key) => Number(byAgency.get(id)?.[key] || 0);
      memberCount = { get: (id) => num(id, "members") };
      candidateCount = { get: (id) => num(id, "candidates") };
      jobCount = { get: (id) => num(id, "jobs") };
      monthCount = { get: (id) => num(id, "candidates_month") };
      lastActivityOf = (id) => {
        const t = byAgency.get(id)?.last_activity;
        return t ? Date.parse(t) : 0;
      };
    } else {
      // Fallback: tally capped row pulls in JavaScript.
      const [candidates, jobs] = await Promise.all([
        supabase.from("candidates").select("agency_id,created_at").limit(ROW_CAP),
        supabase.from("jobs").select("agency_id,created_at,status").limit(ROW_CAP),
      ]);
      for (const result of [candidates, jobs]) {
        if (result.error) return adminDbError("agencies", result.error);
      }
      memberCount = tally(profiles.data, "agency_id");
      candidateCount = tally(candidates.data, "agency_id");
      jobCount = tally(jobs.data, "agency_id");
      const monthStart = Date.parse(startOfMonthUtc());
      monthCount = tally((candidates.data || []).filter((c) => Date.parse(c.created_at) >= monthStart), "agency_id");
      const lastCandidate = latest(candidates.data, "agency_id", "created_at");
      const lastJob = latest(jobs.data, "agency_id", "created_at");
      lastActivityOf = (id) => Math.max(lastCandidate.get(id) || 0, lastJob.get(id) || 0);
      truncated = [profiles, candidates, jobs].some((r) => (r.data || []).length >= ROW_CAP);
    }

    // A subscription belongs to whoever paid (one profile); every member of that
    // agency shares its plan, so key it by the payer's agency.
    const agencyOfProfile = new Map((profiles.data || []).map((p) => [p.id, p.agency_id]));
    const subByAgency = new Map();
    for (const raw of subscriptions.data || []) {
      // A demo past its end date no longer grants access (lib/subscription-status.js).
      const sub = demoExpired(raw) ? { ...raw, status: "ended" } : raw;
      const agencyId = agencyOfProfile.get(sub.user_id);
      if (!agencyId) continue;
      const existing = subByAgency.get(agencyId);
      // Prefer an active subscription if an agency somehow has more than one.
      // Prefer a real (Stripe) active subscription over a demo grant.
      const better =
        !existing ||
        (sub.status === "active" && existing.status !== "active") ||
        (sub.status === "active" && existing.status === "active" && sub.stripe_subscription_id && !existing.stripe_subscription_id);
      if (better) subByAgency.set(agencyId, sub);
    }

    const now = Date.now();
    let rows = (agencies.data || []).map((agency) => {
      const sub = subByAgency.get(agency.id);
      const lastActivity = lastActivityOf(agency.id) || null;
      const limit = Number(agency.analyses_limit) || null;
      const used = Number(agency.analyses_used) || 0;
      return {
        id: agency.id,
        name: agency.name || "(unnamed)",
        createdAt: agency.created_at,
        plan: sub?.plan || null,
        subscriptionStatus: sub?.status || null,
        demo: Boolean(sub && !sub.stripe_subscription_id),
        suspended: Boolean(agency.suspended_at),
        screeningCap: agency.screening_cap || null,
        screeningsThisMonth: monthCount.get(agency.id) || 0,
        members: memberCount.get(agency.id) || 0,
        candidates: candidateCount.get(agency.id) || 0,
        jobs: jobCount.get(agency.id) || 0,
        analysesUsed: used,
        analysesLimit: limit,
        lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
        active30d: lastActivity ? now - lastActivity < 30 * DAY : false,
        hasTeamWorkspace: Boolean(agency.clerk_org_id),
      };
    });

    if (search) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(search) || r.id.includes(search));
    }

    const paying = rows.filter((r) => r.subscriptionStatus === "active" && !r.demo).length;

    return json({
      summary: {
        agencies: rows.length,
        paying,
        active30d: rows.filter((r) => r.active30d).length,
        candidates: rows.reduce((sum, r) => sum + r.candidates, 0),
        jobs: rows.reduce((sum, r) => sum + r.jobs, 0),
        withoutPlan: rows.filter((r) => !r.subscriptionStatus).length,
        demo: rows.filter((r) => r.demo && r.subscriptionStatus === "active").length,
        suspended: rows.filter((r) => r.suspended).length,
      },
      agencies: rows,
      truncated,
    });
  } catch (error) {
    return adminErrorResponse("agencies", error);
  }
}

async function detail(supabase, id) {
  if (!id) return json({ error: "A valid agency id is required." }, 400);

  const agencyQuery = (columns) => supabase.from("agencies").select(columns).eq("id", id).maybeSingle();
  const { data: agency, error } = await agencyQuery(
    "id,name,created_at,plan_name,analyses_limit,analyses_used,intake_email,clerk_org_id,settings,suspended_at,suspended_reason,screening_cap",
  );
  if (error) return adminDbError("agencies", error);
  if (!agency) return json({ error: "Agency not found." }, 404);

  const [members, jobs, candidates, month, history] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,first_name,last_name,clerk_user_id,created_at")
      .eq("agency_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("jobs")
      .select("id,title,client,status,created_at")
      .eq("agency_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("candidates")
      .select("id,name,full_name,current_title,match_score,stage,processing_status,created_at")
      .eq("agency_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("agency_id", id).gte("created_at", startOfMonthUtc()),
    supabase
      .from("admin_audit_logs")
      .select("id,admin_username,action,metadata,created_at")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const result of [members, jobs, candidates]) {
    if (result.error) return adminDbError("agencies", result.error);
  }

  const profileIds = (members.data || []).map((m) => m.id);
  let subscription = null;
  if (profileIds.length) {
    const { data: subs, error: subError } = await supabase
      .from("subscriptions")
      .select("plan,status,stripe_customer_id,stripe_subscription_id,created_at,updated_at,demo_expires_at")
      .in("user_id", profileIds)
      .limit(5);
    if (subError) return adminDbError("agencies", subError);
    // A demo past its end date shows as ended; a live Stripe subscription wins over a demo.
    const shaped = (subs || []).map((s) => (demoExpired(s) ? { ...s, status: "ended" } : s));
    subscription =
      shaped.find((s) => s.status === "active" && s.stripe_subscription_id) || shaped.find((s) => s.status === "active") || shaped[0] || null;
  }

  // Only the safe, useful slice of `settings` - it can hold a signature and
  // other free text an agency wrote, none of which an admin needs here.
  const settings = agency.settings && typeof agency.settings === "object" ? agency.settings : {};

  return json({
    agency: {
      id: agency.id,
      name: agency.name,
      createdAt: agency.created_at,
      intakeEmail: agency.intake_email,
      analysesUsed: agency.analyses_used,
      analysesLimit: agency.analyses_limit,
      hasTeamWorkspace: Boolean(agency.clerk_org_id),
      settingsPlan: settings.plan || null,
      companyName: settings.company_name || null,
      suspendedAt: agency.suspended_at || null,
      suspendedReason: agency.suspended_reason || null,
      screeningCap: agency.screening_cap || null,
      screeningsThisMonth: month.count || 0,
    },
    history: (history.data || []).map((h) => ({ id: h.id, admin: h.admin_username, action: h.action, metadata: h.metadata || {}, at: h.created_at })),
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          stripeCustomerId: subscription.stripe_customer_id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          demo: !subscription.stripe_subscription_id,
          demoExpiresAt: subscription.stripe_subscription_id ? null : subscription.demo_expires_at || null,
          since: subscription.created_at,
          updatedAt: subscription.updated_at,
        }
      : null,
    members: (members.data || []).map((m) => ({
      id: m.id,
      clerkUserId: m.clerk_user_id || null,
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || "(no name)",
      username: m.username,
      provider: m.clerk_user_id ? "clerk" : "legacy",
      joinedAt: m.created_at,
    })),
    recentJobs: jobs.data || [],
    recentCandidates: (candidates.data || []).map((c) => ({
      id: c.id,
      name: c.full_name || c.name || "(unnamed)",
      title: c.current_title,
      score: c.match_score,
      stage: c.stage,
      status: c.processing_status,
      createdAt: c.created_at,
    })),
  });
}

// ── Controls ─────────────────────────────────────────────────────────────
//   { id, action: "rename", name }
//   { id, action: "suspend", reason } / { id, action: "unsuspend" }
//   { id, action: "set_cap", cap }            cap: positive integer or null
//   { id, action: "remove_member", profileId } detaches one member's profile
export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const supabase = getAdminSupabase();
    const body = (await request.json().catch(() => null)) || {};
    const id = cleanUuid(body.id);
    const action = cleanLine(body.action, 40);
    if (!id) return json({ error: "A valid agency id is required." }, 400);

    const { data: agency, error } = await supabase.from("agencies").select("id,name").eq("id", id).maybeSingle();
    if (error) return adminDbError("agencies", error);
    if (!agency) return json({ error: "Agency not found." }, 404);

    let update = null;
    let metadata = { name: agency.name };
    let auditAction = `agency_${action}`;

    if (action === "rename") {
      const name = cleanLine(body.name, 120);
      if (!name) return json({ error: "A name is required." }, 400);
      update = { name };
      metadata = { from: agency.name, to: name };
      auditAction = "agency_update";
    } else if (action === "suspend") {
      const reason = cleanLine(body.reason, 300) || null;
      update = { suspended_at: new Date().toISOString(), suspended_reason: reason };
      metadata = { name: agency.name, reason };
    } else if (action === "unsuspend") {
      update = { suspended_at: null, suspended_reason: null };
    } else if (action === "set_cap") {
      const raw = body.cap === null || body.cap === "" ? null : Math.round(Number(body.cap));
      if (raw !== null && (!Number.isFinite(raw) || raw < 1 || raw > 100000)) {
        return json({ error: "The cap must be a whole number from 1 to 100,000, or empty for no cap." }, 400);
      }
      update = { screening_cap: raw };
      metadata = { name: agency.name, screeningCap: raw };
      auditAction = "agency_update";
    } else if (action === "remove_member") {
      const profileId = cleanUuid(body.profileId);
      if (!profileId) return json({ error: "A valid member id is required." }, 400);
      const { data: removed, error: removeError } = await supabase
        .from("profiles")
        .update({ agency_id: null })
        .eq("id", profileId)
        .eq("agency_id", id)
        .select("id,first_name,last_name,username");
      if (removeError) return adminDbError("agencies", removeError);
      if (!removed?.length) return json({ error: "That person isn't a member of this agency." }, 404);
      const m = removed[0];
      metadata = { name: agency.name, member: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || profileId };
    } else {
      return json({ error: "Unknown agency action." }, 400);
    }

    if (update) {
      const { error: updateError } = await supabase.from("agencies").update(update).eq("id", id);
      if (updateError) return adminDbError("agencies", updateError);
    }

    await writeAdminAudit({ adminUsername: admin.username, action: auditAction, targetType: "agency", targetId: id, metadata, request });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("agencies", error);
  }
}
