// Test accounts on the customer side: the limits a test workspace runs
// under, and the sign-in and first-screening times the admin console
// shows (Admin > Customers > Test accounts; lib/admin/test-accounts.js
// creates and manages them). A test workspace is an agency with a
// test_accounts row that hasn't converted to a paid plan or been deleted.

import "server-only";
import { supabase } from "@/lib/supabase";
import { reportError } from "@/lib/report-error";
import { escapeHtml, sendAdminAlert } from "@/lib/security/alert-email";
import { alertRecipients, getSiteSettings } from "@/lib/ops/site-settings";

export const TEST_FEATURE_REFUSAL = "This isn't available on this account. Contact Helixon at hello@helixon.co.uk if you need it.";

const COLUMNS = "id,agency_id,name,email,ends_at,email_daily_cap,first_seen_at,last_seen_at,first_screening_at";
const CACHE_MS = 60_000;
const SEEN_EVERY_MS = 5 * 60_000;
const cache = new Map(); // agencyId -> { row, until }
const lastSeenWrite = new Map(); // agencyId -> ms

export function _clearTestAccountCache() {
  cache.clear();
  lastSeenWrite.clear();
}

/**
 * The status the console shows for a test_accounts row.
 * @returns {"active" | "expired" | "ended" | "converted" | "deleted"}
 */
export function testAccountStatus(row, now = Date.now()) {
  if (row.deleted_at) return "deleted";
  if (row.converted_at) return "converted";
  if (row.ended_at) return "ended";
  if (row.ends_at && Date.parse(row.ends_at) <= now) return "expired";
  return "active";
}

/**
 * The agency's live test_accounts row, or null for an ordinary (or
 * converted) workspace. Cached for a minute. A lookup error counts as
 * "not a test account": these checks must never lock out a paying customer.
 * @param {string | null | undefined} agencyId
 */
export async function isTestAgency(agencyId) {
  if (!agencyId) return null;
  const hit = cache.get(agencyId);
  if (hit && hit.until > Date.now()) return hit.row;
  const { data, error } = await supabase
    .from("test_accounts")
    .select(COLUMNS)
    .eq("agency_id", agencyId)
    .is("converted_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    reportError("[test-account] lookup failed:", error.message);
    return null;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(agencyId, { row: data || null, until: Date.now() + CACHE_MS });
  return data || null;
}

/**
 * Why a test workspace may not email `count` people outside it now, or
 * null (also for every ordinary workspace). Takes the emails from the day's
 * allowance when allowed.
 */
export async function testEmailRefusal(agencyId, count = 1) {
  const row = await isTestAgency(agencyId);
  if (!row) return null;
  const { data, error } = await supabase.rpc("test_account_take_emails", { p_agency_id: agencyId, p_count: count });
  if (error) reportError("[test-account] email allowance failed:", error.message);
  if (data === true) return null;
  return `This account can send up to ${row.email_daily_cap} emails a day to people outside your workspace. Try again tomorrow.`;
}

async function alertAdmins(subject, lines) {
  try {
    const to = alertRecipients(await getSiteSettings());
    if (!to.length) return;
    await sendAdminAlert({
      to,
      subject,
      html: `${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p>Admin console › Customers › Test accounts has the full activity.</p>`,
    });
  } catch (err) {
    reportError("[test-account] alert failed:", err?.message || err);
  }
}

function who(row) {
  return `${row.name} (${row.email})`;
}

/**
 * A signed-in page load by a member of this agency (from /api/auth/me).
 * Updates last_seen_at at most every 5 minutes, and the first time
 * records first_seen_at and tells the admins.
 */
export async function noteSeen(agencyId) {
  try {
    const last = lastSeenWrite.get(agencyId);
    if (last && Date.now() - last < SEEN_EVERY_MS) return;
    const row = await isTestAgency(agencyId);
    if (!row) return;
    lastSeenWrite.set(agencyId, Date.now());
    const now = new Date().toISOString();
    await supabase.from("test_accounts").update({ last_seen_at: now }).eq("id", row.id);
    if (row.first_seen_at) return;
    const { data } = await supabase.from("test_accounts").update({ first_seen_at: now }).eq("id", row.id).is("first_seen_at", null).select("id");
    if (data?.length) await alertAdmins(`Test account signed in: ${row.name}`, [`${who(row)} signed in to Helixon for the first time.`]);
  } catch (err) {
    reportError("[test-account] noteSeen failed:", err?.message || err);
  }
}

/** After a screening (from /api/run): the first one is recorded and the admins told. */
export async function noteFirstScreening(agencyId) {
  try {
    const row = await isTestAgency(agencyId);
    if (!row || row.first_screening_at) return;
    const { data } = await supabase
      .from("test_accounts")
      .update({ first_screening_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("first_screening_at", null)
      .select("id");
    cache.delete(agencyId);
    if (data?.length) await alertAdmins(`Test account ran its first screening: ${row.name}`, [`${who(row)} screened their first CV.`]);
  } catch (err) {
    reportError("[test-account] noteFirstScreening failed:", err?.message || err);
  }
}
