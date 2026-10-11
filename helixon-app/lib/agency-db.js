// Database client for customer API routes' queries on agency tables.
//
//   const db = await agencyDb();
//   await db.from("candidates").select("*").eq("agency_id", agencyId);
//
// When SUPABASE_JWT_SECRET is set (and SUPABASE_AGENCY_RLS isn't "0"), this
// is a client whose requests carry a short-lived JWT this server signs for
// the `agency_member` database role with the signed-in member's agency_id.
// The RLS policies from migration 20261005000000_agency_member_rls then
// refuse any row from another agency, even if a query forgets its agency
// filter. The `.eq("agency_id", ...)` filters stay: they are the first
// check, this is the second.
//
// Before handing out that client, a probe checks the database really
// enforces it (probeAgencySeparation, re-run every few minutes). If it
// doesn't - the migration isn't applied yet, or the secret is wrong - this
// returns the service-role client, so customers keep working on the app's
// own filters, and reports the problem to Sentry and /admin/health. Failing
// closed there would take the whole product down over a missing second
// check. See docs/runbook.md.

import "server-only";
import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { reportError } from "@/lib/report-error";

export { AGENCY_RLS_EXCLUDED } from "@/lib/agency/tables";

const TOKEN_SECONDS = 300;
// How long a member's agency is reused before it is looked up again. Short,
// so someone moved to another agency loses the old one within seconds.
const CACHE_MS = 30_000;

// How often a working (or broken) result is re-checked, so applying the
// migration takes effect without a redeploy.
const PROBE_EVERY_MS = 5 * 60_000;

const cache = new Map(); // clerk user id -> { client, agencyId, until }
let probeState = { at: 0, ok: null, error: null, running: null };

// On by default once the secret is there; SUPABASE_AGENCY_RLS=0 turns it off.
export function agencyRlsConfigured() {
  return process.env.SUPABASE_AGENCY_RLS !== "0" && Boolean(process.env.SUPABASE_JWT_SECRET);
}

const b64url = (input) => Buffer.from(input).toString("base64url");

export function signAgencyToken({ agencyId, userId, secret, now = Date.now() }) {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      role: "agency_member",
      aud: "authenticated",
      sub: userId,
      agency_id: agencyId,
      iat,
      exp: iat + TOKEN_SECONDS,
    })
  );
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function clientFor(token) {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}

// Reads an agency table with a token for an agency that doesn't exist.
// Working separation answers with no rows. An error (no agency_member role
// or policies: the migration isn't applied) or any row at all (the policies
// aren't enforced) means it isn't working.
export async function probeAgencySeparation() {
  try {
    const token = signAgencyToken({ agencyId: crypto.randomUUID(), userId: "agency-db-probe", secret: process.env.SUPABASE_JWT_SECRET });
    const { data, error } = await clientFor(token).from("candidates").select("id").limit(1);
    if (error) return { ok: false, error: error.message };
    if ((data || []).length) return { ok: false, error: "A token for an unknown agency could read rows, so the policies aren't enforced." };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function separationWorking() {
  if (probeState.ok !== null && Date.now() - probeState.at < PROBE_EVERY_MS) return probeState.ok;
  probeState.running ??= probeAgencySeparation().then((result) => {
    const was = probeState.ok;
    probeState = { at: Date.now(), ok: result.ok, error: result.error, running: null };
    // Once per change, not on every re-check.
    if (!result.ok && was !== false) {
      reportError("[agency-db] Database-level agency separation is configured but not working; using the service-role client (the app's agency filters still apply):", result.error);
    }
    return result.ok;
  });
  return probeState.running;
}

// For /admin/health: a fresh probe, not the cached result.
export async function getAgencySeparationSnapshot() {
  if (!agencyRlsConfigured()) return { configured: false, switchedOff: process.env.SUPABASE_AGENCY_RLS === "0" };
  const result = await probeAgencySeparation();
  return result.ok ? { configured: true, connected: true } : { configured: true, connected: false, error: result.error };
}

export async function agencyDb() {
  if (!agencyRlsConfigured() || !(await separationWorking())) return supabase;

  const { userId } = await auth();
  // Fail closed: without a member there is no agency to scope to.
  if (!userId) throw new Error("agencyDb() needs a signed-in member");

  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.until > now) return hit.client;

  const { data, error } = await supabase.from("profiles").select("agency_id").eq("clerk_user_id", userId).maybeSingle();
  if (error) throw new Error(`agencyDb(): profile lookup failed: ${error.message}`);
  if (!data?.agency_id) throw new Error("agencyDb(): this member has no agency");

  const token = signAgencyToken({ agencyId: data.agency_id, userId, secret: process.env.SUPABASE_JWT_SECRET, now });
  const client = clientFor(token);
  // Re-sign well before the token itself expires.
  cache.set(userId, { client, agencyId: data.agency_id, until: now + Math.min(CACHE_MS, (TOKEN_SECONDS - 60) * 1000) });
  return client;
}

export function _clearAgencyDbCache() {
  cache.clear();
  probeState = { at: 0, ok: null, error: null, running: null };
}
