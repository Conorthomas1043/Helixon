// Per-person private tokens (member_tokens, migration 20261003020000):
//   calendar   /api/calendar/<token>.ics - their interviews as a feed to
//              subscribe to in Google Calendar, Outlook or Apple Calendar
//   bcc        log+<token>@<inbound domain> - BCC it on an email sent from
//              their own inbox and it's filed against the candidate or
//              client contact it went to (app/api/webhooks/resend-inbound)

import "server-only";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { inboundDomain } from "@/lib/tracked-email";

export const PURPOSES = ["calendar", "bcc"];
const TOKEN_RE = /^[a-f0-9]{32}$/;

export function bccAddress(token, domain = inboundDomain()) {
  return domain && token ? `log+${token}@${domain}` : null;
}

// The token from a log+<token>@<domain> address, or null.
export function bccTokenFromAddress(address, domain = inboundDomain()) {
  if (!domain) return null;
  const m = String(address || "").toLowerCase().match(/log\+([a-f0-9]{32})@([a-z0-9.-]+)/);
  return m && m[2] === domain ? m[1] : null;
}

// The member's token for `purpose`, made on first use; `rotate` replaces
// it (the old feed URL / address stops working). { token } or { error }.
export async function memberToken(auth, purpose, { rotate = false } = {}) {
  if (!PURPOSES.includes(purpose)) return { error: "Unknown purpose." };
  if (!rotate) {
    const { data, error } = await supabase.from("member_tokens").select("token").eq("agency_id", auth.agencyId).eq("user_id", auth.userId).eq("purpose", purpose).maybeSingle();
    if (error) return { error: error.message, unavailable: true };
    if (data) return { token: data.token };
  }
  const token = crypto.randomBytes(16).toString("hex");
  const { error } = await supabase
    .from("member_tokens")
    .upsert({ agency_id: auth.agencyId, user_id: auth.userId, purpose, token, created_at: new Date().toISOString() }, { onConflict: "agency_id,user_id,purpose" });
  if (error) return { error: error.message, unavailable: true };
  return { token };
}

// { agency_id, user_id } for a token, or null. Only while the person is
// still in that agency: a token outlives nothing it was issued for, even
// if a removal path missed revokeMemberTokens.
export async function memberForToken(token, purpose) {
  if (!TOKEN_RE.test(token || "") || !PURPOSES.includes(purpose)) return null;
  const { data } = await supabase.from("member_tokens").select("agency_id, user_id").eq("token", token).eq("purpose", purpose).maybeSingle();
  if (!data) return null;
  const { data: profile, error } = await supabase.from("profiles").select("id").eq("clerk_user_id", data.user_id).eq("agency_id", data.agency_id).maybeSingle();
  if (error || !profile) return null;
  return data;
}

// Deletes a person's tokens - their calendar feed and BCC address stop
// working. Called whenever someone leaves an agency. Never throws: the
// membership check in memberForToken still holds if this fails.
export async function revokeMemberTokens(clerkUserId, agencyId = null) {
  if (!clerkUserId) return;
  let query = supabase.from("member_tokens").delete().eq("user_id", clerkUserId);
  if (agencyId) query = query.eq("agency_id", agencyId);
  const { error } = await query;
  if (error) console.error("[member-tokens] Failed to revoke tokens:", error.message);
}
