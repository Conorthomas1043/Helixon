import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanLine, cleanUuid } from "@/lib/sanitize";

// The customer view: one row per agency with the numbers that answer "who is
// using Helixon, on what plan, and how much?". Read-only.
//
// Counts are tallied in JavaScript from narrow selects rather than one query per
// agency. That is fine at today's size (dozens of agencies); the row caps below
// keep it bounded, and a Postgres view/RPC is the upgrade path if it outgrows them.

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

    const [agencies, profiles, subscriptions, candidates, jobs] = await Promise.all([
      supabase
        .from("agencies")
        .select("id,name,created_at,plan_name,analyses_limit,analyses_used,intake_email,clerk_org_id,settings")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("profiles").select("id,agency_id,clerk_user_id,created_at").limit(ROW_CAP),
      supabase.from("subscriptions").select("user_id,plan,status,updated_at").limit(ROW_CAP),
      supabase.from("candidates").select("agency_id,created_at").limit(ROW_CAP),
      supabase.from("jobs").select("agency_id,created_at,status").limit(ROW_CAP),
    ]);

    for (const result of [agencies, profiles, subscriptions, candidates, jobs]) {
      if (result.error) return adminDbError("agencies", result.error);
    }

    const memberCount = tally(profiles.data, "agency_id");
    const candidateCount = tally(candidates.data, "agency_id");
    const jobCount = tally(jobs.data, "agency_id");
    const lastCandidate = latest(candidates.data, "agency_id", "created_at");
    const lastJob = latest(jobs.data, "agency_id", "created_at");

    // A subscription belongs to whoever paid (one profile); every member of that
    // agency shares its plan, so key it by the payer's agency.
    const agencyOfProfile = new Map((profiles.data || []).map((p) => [p.id, p.agency_id]));
    const subByAgency = new Map();
    for (const sub of subscriptions.data || []) {
      const agencyId = agencyOfProfile.get(sub.user_id);
      if (!agencyId) continue;
      const existing = subByAgency.get(agencyId);
      // Prefer an active subscription if an agency somehow has more than one.
      if (!existing || (sub.status === "active" && existing.status !== "active")) subByAgency.set(agencyId, sub);
    }

    const now = Date.now();
    let rows = (agencies.data || []).map((agency) => {
      const sub = subByAgency.get(agency.id);
      const lastActivity = Math.max(lastCandidate.get(agency.id) || 0, lastJob.get(agency.id) || 0) || null;
      const limit = Number(agency.analyses_limit) || null;
      const used = Number(agency.analyses_used) || 0;
      return {
        id: agency.id,
        name: agency.name || "(unnamed)",
        createdAt: agency.created_at,
        plan: sub?.plan || null,
        subscriptionStatus: sub?.status || null,
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

    const paying = rows.filter((r) => r.subscriptionStatus === "active").length;

    return json({
      summary: {
        agencies: rows.length,
        paying,
        active30d: rows.filter((r) => r.active30d).length,
        candidates: rows.reduce((sum, r) => sum + r.candidates, 0),
        jobs: rows.reduce((sum, r) => sum + r.jobs, 0),
        withoutPlan: rows.filter((r) => !r.subscriptionStatus).length,
      },
      agencies: rows,
      truncated: [profiles, candidates, jobs].some((r) => (r.data || []).length >= ROW_CAP),
    });
  } catch (error) {
    return adminErrorResponse("agencies", error);
  }
}

async function detail(supabase, id) {
  if (!id) return json({ error: "A valid agency id is required." }, 400);

  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id,name,created_at,plan_name,analyses_limit,analyses_used,intake_email,clerk_org_id,settings")
    .eq("id", id)
    .maybeSingle();
  if (error) return adminDbError("agencies", error);
  if (!agency) return json({ error: "Agency not found." }, 404);

  const [members, jobs, candidates] = await Promise.all([
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
  ]);
  for (const result of [members, jobs, candidates]) {
    if (result.error) return adminDbError("agencies", result.error);
  }

  const profileIds = (members.data || []).map((m) => m.id);
  let subscription = null;
  if (profileIds.length) {
    const { data: subs, error: subError } = await supabase
      .from("subscriptions")
      .select("plan,status,stripe_customer_id,stripe_subscription_id,created_at,updated_at")
      .in("user_id", profileIds)
      .limit(5);
    if (subError) return adminDbError("agencies", subError);
    subscription = (subs || []).find((s) => s.status === "active") || (subs || [])[0] || null;
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
    },
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          stripeCustomerId: subscription.stripe_customer_id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          since: subscription.created_at,
          updatedAt: subscription.updated_at,
        }
      : null,
    members: (members.data || []).map((m) => ({
      id: m.id,
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
