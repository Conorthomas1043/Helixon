// Database client for customer API routes' queries on agency tables.
//
//   const db = await agencyDb();
//   await db.from("candidates").select("*").eq("agency_id", agencyId);
//
// Switched off (the default), this is the service-role client, exactly as
// before. Switched on (SUPABASE_AGENCY_RLS=1 plus SUPABASE_JWT_SECRET), it is
// a client whose requests carry a short-lived JWT this server signs for the
// `agency_member` database role with the signed-in member's agency_id. The
// RLS policies from migration 20261005000000_agency_member_rls then refuse
// any row from another agency, even if a query forgets its agency filter.
// The `.eq("agency_id", ...)` filters stay: they are the first check, this is
// the second.
//
// Turning it on: apply the migration, set SUPABASE_JWT_SECRET to the
// project's JWT secret (Supabase > Project Settings > JWT Keys > legacy JWT
// secret), then SUPABASE_AGENCY_RLS=1. See docs/runbook.md.

import "server-only";
import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export { AGENCY_RLS_EXCLUDED } from "@/lib/agency-tables";

const TOKEN_SECONDS = 300;
// How long a member's agency is reused before it is looked up again. Short,
// so someone moved to another agency loses the old one within seconds.
const CACHE_MS = 30_000;

const cache = new Map(); // clerk user id -> { client, agencyId, until }

export function agencyRlsEnabled() {
  return process.env.SUPABASE_AGENCY_RLS === "1" && Boolean(process.env.SUPABASE_JWT_SECRET);
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

export async function agencyDb() {
  if (!agencyRlsEnabled()) return supabase;

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
}
