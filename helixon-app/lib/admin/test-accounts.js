import "server-only";

// Test accounts for the admin console (Admin > Customers > Test accounts,
// app/api/admin/test-accounts): a working Helixon login for a prospect with
// no payment, and what they've done with it. The route checks the admin
// session and CSRF token, then calls these. The limits a test workspace
// runs under are in lib/agency/test-account.js.
//
// A test account is an ordinary Clerk user, profile and agency, with a demo
// subscription row (no Stripe id, demo_expires_at = the end date - the
// same row Admin > Users' "grant demo access" writes) and a test_accounts
// row. Clerk's publicMetadata.helixon_test_account tells the user.created
// webhook to leave the account alone.

import { cleanEmail, cleanLine } from "@/lib/sanitize";
import { createProfileAndAgency, generateUsername } from "@/lib/auth/create-profile";
import { generateEmployeePassword } from "@/lib/employee/auth";
import { siteUrl } from "@/lib/messaging/mailer";
import { testAccountStatus } from "@/lib/agency/test-account";
import { escapeHtml } from "@/lib/format";

export const TEST_ACCOUNT_PLAN = "agency";
export const DEFAULT_SCREENING_CAP = 50;
const MAX_TIMELINE = 200;

/** An end date `days` (1-365) from now, or null for none. */
export function endsAtFor(days, now = Date.now()) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 1) return null;
  return new Date(now + Math.min(Math.floor(n), 365) * 86400e3).toISOString();
}

function cleanCap(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
}

/** Entries from several sources ({ at, ... }), newest first, at most 200. */
export function mergeTimeline(sources) {
  return sources
    .flatMap((s) => s || [])
    .filter((e) => e?.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_TIMELINE);
}

function splitName(name) {
  const [first, ...rest] = name.split(/\s+/);
  return { firstName: first || "", lastName: rest.join(" ") };
}

function clerkMessage(err) {
  return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || null;
}

// The demo subscription row of the account's profile. Every write is
// limited to rows with no Stripe subscription id, so a test account that
// has since bought a plan never has its real subscription touched.
async function profileIdFor(supabase, clerkUserId) {
  if (!clerkUserId) return null;
  const { data, error } = await supabase.from("profiles").select("id").eq("clerk_user_id", clerkUserId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

async function setDemoAccess(supabase, account, patch) {
  const profileId = await profileIdFor(supabase, account.clerk_user_id);
  if (!profileId) return;
  const { error } = await supabase
    .from("subscriptions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", profileId)
    .is("stripe_subscription_id", null);
  if (error) throw new Error(error.message);
}

async function updateAccount(supabase, account, patch) {
  const { error } = await supabase.from("test_accounts").update(patch).eq("id", account.id);
  if (error) throw new Error(error.message);
}

/**
 * Makes the login and workspace. Returns { account, username, password,
 * signInUrl } (the password is never stored or shown again) or
 * { status, error }. On a failure after the Clerk user exists, everything
 * made so far is removed and the error rethrown.
 */
export async function createTestAccount({ client, supabase, input, admin }) {
  const name = cleanLine(input?.name, 120);
  const email = cleanEmail(input?.email);
  if (!name) return { status: 400, error: "A name is required." };
  if (!email) return { status: 400, error: "A valid email is required." };
  const agencyName = cleanLine(input?.agencyName, 100) || `${name}'s agency`;
  const screeningCap = input?.screeningCap == null || input.screeningCap === "" ? DEFAULT_SCREENING_CAP : cleanCap(input.screeningCap);
  if (!screeningCap) return { status: 400, error: "The screening limit must be a whole number from 1 to 10,000." };
  const endsAt = endsAtFor(input?.days);

  const { data: existing } = await client.users.getUserList({ emailAddress: [email] });
  if (existing?.length) return { status: 409, error: "That email already has a Helixon login. Use Admin › Users to give it demo access instead." };

  const { firstName, lastName } = splitName(name);
  const username = await generateUsername(email.split("@")[0]);
  const password = generateEmployeePassword();

  let user;
  try {
    user = await client.users.createUser({
      emailAddress: [email],
      username,
      password,
      firstName,
      lastName,
      publicMetadata: { is_test_user: true, test_label: "Test account", helixon_test_account: true },
    });
  } catch (err) {
    if (err?.status === 422 || err?.status === 400) return { status: 400, error: clerkMessage(err) || "Clerk refused that account." };
    throw err;
  }

  let made = null;
  try {
    made = await createProfileAndAgency({ clerkUserId: user.id, email, firstName, lastName, username, agencyName, plan: TEST_ACCOUNT_PLAN });

    const sub = await supabase.from("subscriptions").upsert(
      {
        user_id: made.profileId,
        plan: TEST_ACCOUNT_PLAN,
        stripe_subscription_id: null,
        status: "active",
        demo_expires_at: endsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (sub.error) throw new Error(sub.error.message);

    const cap = await supabase.from("agencies").update({ screening_cap: screeningCap }).eq("id", made.agencyId);
    if (cap.error) throw new Error(cap.error.message);

    const { data: account, error } = await supabase
      .from("test_accounts")
      .insert({ agency_id: made.agencyId, clerk_user_id: user.id, name, email, created_by: admin?.username || null, ends_at: endsAt })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return { account, username, password, signInUrl: `${siteUrl()}/login` };
  } catch (err) {
    if (made) {
      await supabase.from("subscriptions").delete().eq("user_id", made.profileId);
      await supabase.from("profiles").delete().eq("id", made.profileId);
      await supabase.from("agencies").delete().eq("id", made.agencyId);
    }
    await client.users.deleteUser(user.id).catch(() => {});
    throw err;
  }
}

/**
 * One console action on an account: extend { days }, end, set_cap { cap },
 * reset_password. Returns { password } for reset_password, null when done,
 * or { status, error }.
 */
export async function applyTestAccountAction({ client, supabase, account, action, body }) {
  if (account.deleted_at) return { status: 404, error: "That test account was deleted." };
  if (account.converted_at && action !== "set_cap") return { status: 409, error: "This account has bought a plan, so it's an ordinary customer now." };

  if (action === "extend") {
    const endsAt = endsAtFor(body?.days);
    await setDemoAccess(supabase, account, { status: "active", demo_expires_at: endsAt });
    await updateAccount(supabase, account, { ends_at: endsAt, ended_at: null });
    return null;
  }
  if (action === "end") {
    const now = new Date().toISOString();
    await setDemoAccess(supabase, account, { status: "canceled", demo_expires_at: now });
    await updateAccount(supabase, account, { ended_at: now });
    return null;
  }
  if (action === "set_cap") {
    const cap = cleanCap(body?.cap);
    if (!cap) return { status: 400, error: "The screening limit must be a whole number from 1 to 10,000." };
    const { error } = await supabase.from("agencies").update({ screening_cap: cap }).eq("id", account.agency_id);
    if (error) throw new Error(error.message);
    return null;
  }
  if (action === "reset_password") {
    if (!account.clerk_user_id) return { status: 409, error: "This account has no login." };
    const password = generateEmployeePassword();
    await client.users.updateUser(account.clerk_user_id, { password });
    return { password };
  }
  return { status: 400, error: "Unknown test account action." };
}

/**
 * Deletes the login and stops access. The workspace and what the tester
 * put in it stay, under Admin > Agencies, like any deleted user's.
 */
export async function deleteTestAccount({ client, supabase, account }) {
  const now = new Date().toISOString();
  if (!account.converted_at) await setDemoAccess(supabase, account, { status: "canceled", demo_expires_at: now });
  if (account.clerk_user_id) {
    try {
      await client.users.deleteUser(account.clerk_user_id);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }
  await updateAccount(supabase, account, { deleted_at: now });
}

async function countFor(supabase, table, agencyId) {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("agency_id", agencyId);
  return count || 0;
}

/** Every undeleted test account with its status and usage, newest first. */
export async function listTestAccounts(supabase, now = Date.now()) {
  const { data, error } = await supabase.from("test_accounts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const agencyIds = rows.map((r) => r.agency_id);
  const { data: agencies } = agencyIds.length ? await supabase.from("agencies").select("id,name,screening_cap").in("id", agencyIds) : { data: [] };
  const agencyById = new Map((agencies || []).map((a) => [a.id, a]));

  return Promise.all(rows.map(async (row) => shapeAccount(row, agencyById.get(row.agency_id), await testAccountUsage(supabase, row), now)));
}

/** Screenings, candidates and jobs in the workspace, and emails sent to people outside it. */
export async function testAccountUsage(supabase, row) {
  const [screenings, candidates, jobs] = await Promise.all([
    countFor(supabase, "scores", row.agency_id),
    countFor(supabase, "candidates", row.agency_id),
    countFor(supabase, "jobs", row.agency_id),
  ]);
  return { screenings, candidates, jobs, emails: row.emails_total || 0 };
}

export function shapeAccount(row, agency, usage, now = Date.now()) {
  const status = testAccountStatus(row, now);
  const daysLeft = status === "active" && row.ends_at ? Math.max(0, Math.ceil((Date.parse(row.ends_at) - now) / 86400e3)) : null;
  return {
    id: row.id,
    agencyId: row.agency_id,
    agencyName: agency?.name || null,
    screeningCap: agency?.screening_cap ?? null,
    clerkUserId: row.clerk_user_id,
    name: row.name,
    email: row.email,
    createdBy: row.created_by,
    createdAt: row.created_at,
    endsAt: row.ends_at,
    status,
    daysLeft,
    emailDailyCap: row.email_daily_cap,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    firstScreeningAt: row.first_screening_at,
    endedAt: row.ended_at,
    convertedAt: row.converted_at,
    usage,
  };
}

const ACTIVITY_LABEL = (type) => String(type || "activity").replace(/[_.]/g, " ");

/** What the account did, newest first, from every source the console reads. */
export async function testAccountTimeline(supabase, account) {
  const agencyId = account.agency_id;
  const [audit, candidates, scores, jobs, admin] = await Promise.all([
    supabase.from("agency_audit_log").select("created_at,actor_name,action,summary").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(MAX_TIMELINE),
    supabase.from("candidates").select("id,full_name,name").eq("agency_id", agencyId).limit(2000),
    supabase.from("scores").select("created_at,candidate_id,job_id,match_score").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(MAX_TIMELINE),
    supabase.from("jobs").select("id,title,created_at").eq("agency_id", agencyId).limit(2000),
    supabase.from("admin_audit_logs").select("created_at,admin_username,action").eq("target_id", account.id).order("created_at", { ascending: false }).limit(50),
  ]);

  const candidateName = new Map((candidates.data || []).map((c) => [c.id, c.full_name || c.name || "a candidate"]));
  const jobTitle = new Map((jobs.data || []).map((j) => [j.id, j.title || "a job"]));
  const candidateIds = [...candidateName.keys()].slice(0, 1000);
  const activity = candidateIds.length
    ? await supabase.from("candidate_activity").select("created_at,candidate_id,type,actor").in("candidate_id", candidateIds).order("created_at", { ascending: false }).limit(MAX_TIMELINE)
    : { data: [] };

  const own = [
    { at: account.created_at, kind: "account", text: `Account created${account.created_by ? ` by ${account.created_by}` : ""}` },
    { at: account.first_seen_at, kind: "account", text: "First sign-in" },
    { at: account.first_screening_at, kind: "account", text: "First screening" },
    { at: account.ended_at, kind: "account", text: "Access ended" },
    { at: account.converted_at, kind: "account", text: "Bought a plan" },
  ];

  return mergeTimeline([
    own,
    (audit.data || []).map((r) => ({ at: r.created_at, kind: "workspace", text: r.summary || ACTIVITY_LABEL(r.action), actor: r.actor_name })),
    (activity.data || []).map((r) => ({ at: r.created_at, kind: "candidate", text: `${ACTIVITY_LABEL(r.type)}: ${candidateName.get(r.candidate_id) || "a candidate"}`, actor: r.actor })),
    (scores.data || []).map((r) => ({
      at: r.created_at,
      kind: "screening",
      text: `Screened ${candidateName.get(r.candidate_id) || "a candidate"} for ${jobTitle.get(r.job_id) || "a job"}${r.match_score != null ? `: ${r.match_score}` : ""}`,
    })),
    (jobs.data || []).map((r) => ({ at: r.created_at, kind: "job", text: `Created job ${r.title || "(untitled)"}` })),
    (admin.data || []).map((r) => ({ at: r.created_at, kind: "admin", text: `Admin: ${ACTIVITY_LABEL(r.action.replace(/^test_account_/, ""))}`, actor: r.admin_username })),
  ]);
}

// ── Daily summary (app/api/cron/admin-daily) ────────────────────────────────

/**
 * Each live test account's last 24 hours: what was added, whether they
 * signed in, and whether access ran out.
 */
export async function testAccountDigest(supabase, now = Date.now()) {
  const since = new Date(now - 86400e3).toISOString();
  const { data, error } = await supabase.from("test_accounts").select("*").is("deleted_at", null).is("converted_at", null).limit(200);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const agencyIds = rows.map((r) => r.agency_id);
  const { data: agencies } = agencyIds.length ? await supabase.from("agencies").select("id,name").in("id", agencyIds) : { data: [] };
  const names = new Map((agencies || []).map((a) => [a.id, a.name]));
  const since24h = async (table, agencyId) => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("agency_id", agencyId).gte("created_at", since);
    return count || 0;
  };
  const inWindow = (at) => Boolean(at) && at >= since && Date.parse(at) <= now;
  return Promise.all(
    rows.map(async (row) => ({
      name: row.name,
      email: row.email,
      agencyName: names.get(row.agency_id) || null,
      screenings: await since24h("scores", row.agency_id),
      candidates: await since24h("candidates", row.agency_id),
      jobs: await since24h("jobs", row.agency_id),
      seen: inWindow(row.last_seen_at),
      expiredToday: inWindow(row.ends_at) || inWindow(row.ended_at),
    })),
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The summary email for testAccountDigest's entries, or null on a quiet day. */
export function digestEmail(entries) {
  const active = entries.filter((e) => e.seen || e.screenings || e.candidates || e.jobs);
  const expired = entries.filter((e) => e.expiredToday);
  if (!active.length && !expired.length) return null;
  const who = (e) => `<strong>${escapeHtml(e.name)}</strong> (${escapeHtml(e.email)}${e.agencyName ? `, ${escapeHtml(e.agencyName)}` : ""})`;
  const parts = [];
  if (active.length) {
    parts.push(
      "<h3>Active</h3><ul>",
      ...active.map((e) => `<li>${who(e)}: ${plural(e.screenings, "screening")}, ${plural(e.candidates, "candidate")}, ${plural(e.jobs, "job")}${e.seen ? ", signed in" : ""}</li>`),
      "</ul>",
    );
  }
  if (expired.length) parts.push("<h3>Access ended</h3><ul>", ...expired.map((e) => `<li>${who(e)}</li>`), "</ul>");
  parts.push("<p>Admin console › Customers › Test accounts has each account's full activity.</p>");
  const subject = [active.length ? `${active.length} active` : null, expired.length ? `${expired.length} expired` : null].filter(Boolean).join(", ");
  return { subject: `Test accounts: ${subject} in the last day`, html: parts.join("") };
}
