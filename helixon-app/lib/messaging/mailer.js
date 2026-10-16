// Email sent on an agency's behalf - interview invites, scorecard and
// reference requests, templates and sequences. From the agency's name at
// the Helixon sending address (RESEND_FROM_EMAIL); replies go to the
// recruiter who sent it.

import "server-only";
import { Resend } from "resend";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { agencyDisplayName } from "@/lib/agency/display";
import { agencyHasActiveSubscription } from "@/lib/auth/customer-auth";
import { rateLimit } from "@/lib/ratelimit";
import { testEmailRefusal } from "@/lib/agency/test-account";
import { reportError } from "@/lib/report-error";

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

// Every email sent for an agency goes out through Helixon's own Resend
// account and domain, to addresses the agency chooses, with a sender name
// and text it chooses. So only a workspace with an active subscription may
// send to people outside it, and every workspace has an hourly cap.
export const AGENCY_EMAILS_PER_HOUR = 1000;
export const SUBSCRIPTION_NEEDED_TO_SEND = "Sending email needs an active Helixon subscription.";
const PAID_CACHE_MS = 60_000;
const paidCache = new Map(); // agencyId -> { paid, until }

async function agencyPaid(agencyId) {
  const hit = paidCache.get(agencyId);
  if (hit && hit.until > Date.now()) return hit.paid;
  const paid = await agencyHasActiveSubscription(agencyId).catch((err) => {
    reportError("[mailer] Subscription check failed:", err?.message);
    return false;
  });
  if (paidCache.size > 5000) paidCache.clear();
  paidCache.set(agencyId, { paid, until: Date.now() + PAID_CACHE_MS });
  return paid;
}

/**
 * Why this agency may not send `count` emails now, or null when it may.
 * `toMember` is for alerts to the agency's own members (their Clerk email),
 * which don't need a subscription but still count against the cap.
 * @param {string | null | undefined} agencyId
 * @param {{ toMember?: boolean, count?: number }} [options]
 */
export async function agencySendRefusal(agencyId, { toMember = false, count = 1 } = {}) {
  if (!agencyId) return "The email couldn't be sent.";
  if (!toMember && !(await agencyPaid(agencyId))) return SUBSCRIPTION_NEEDED_TO_SEND;
  // A test workspace (Admin > Test accounts) has a small daily allowance.
  if (!toMember) {
    const limited = await testEmailRefusal(agencyId, count);
    if (limited) return limited;
  }
  if (!(await rateLimit(`agency-email:${agencyId}`, AGENCY_EMAILS_PER_HOUR, { cost: count }))) {
    return "This workspace has sent a lot of email in the last hour - please try again later.";
  }
  return null;
}

export function _clearMailerCache() {
  paidCache.clear();
}

// A display name that can't break the From header.
export function safeFromName(name) {
  return String(name || "").replace(/["<>,;:\\\r\n]/g, "").trim().slice(0, 80) || "Helixon";
}

export async function agencyFromName(agencyId, profile = null) {
  const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
  return agencyDisplayName(data, profile);
}

// The signed-in recruiter's email, for Reply-To. Null outside a request.
export async function senderEmail() {
  const user = await currentUser().catch(() => null);
  return user?.primaryEmailAddress?.emailAddress || null;
}

// Sends one email. `attachments`: [{ filename, content, contentType }].
// `toMember`: see agencySendRefusal. Returns { id } or { error } - never throws.
export async function sendAgencyEmail({ agencyId, profile = null, to, subject, text, html, attachments, replyTo, fromName, toMember = false }) {
  if (!mailConfigured()) return { error: "Email isn't set up yet." };
  try {
    const refused = await agencySendRefusal(agencyId, { toMember });
    if (refused) return { error: refused };
    const name = fromName || (await agencyFromName(agencyId, profile));
    const reply = replyTo === undefined ? await senderEmail() : replyTo;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: `${safeFromName(name)} <${process.env.RESEND_FROM_EMAIL}>`,
      to,
      ...(reply ? { replyTo: reply } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
    if (error) {
      reportError("[mailer] Send failed:", error.message);
      return { error: "The email couldn't be sent." };
    }
    return { id: data?.id ?? null };
  } catch (err) {
    reportError("[mailer] Send failed:", err?.message);
    return { error: "The email couldn't be sent." };
  }
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
}
