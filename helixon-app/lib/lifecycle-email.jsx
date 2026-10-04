// Helixon's own emails to a new customer (not email an agency sends to
// candidates - that's lib/mailer.js):
//   1. Welcome, as soon as the workspace exists (lib/create-profile.js).
//   2. One activation nudge, if nothing has been screened 2-7 days later
//      (the weekday reminders cron).
// Before this, a paying customer got a Stripe receipt and nothing else.
// Each email is sent at most once per agency; agencies.settings.lifecycle
// records when. Every send is best-effort and never throws.

import { Resend } from "resend";
import { render } from "@react-email/render";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { planLabel } from "@/lib/plans";
import { escapeHtml, FROM_EMAIL } from "@/lib/demo-notification";
import WelcomeEmail from "@/emails/WelcomeEmail";

// Replies reach a person, not noreply@.
const REPLY_TO = "hello@helixon.co.uk";
const NUDGE_AFTER_DAYS = 2;
const NUDGE_UNTIL_DAYS = 7;
const NUDGE_CAP = 200;

function configured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
}

// Records a send. Its failure is logged loudly: without the marker the
// nudge would go again on the next weekday run.
async function markSent(agencyId, key) {
  const { data, error: readError } = await supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle();
  if (readError) throw new Error(`Couldn't record ${key}: ${readError.message}`);
  const settings = data?.settings || {};
  const lifecycle = { ...(settings.lifecycle || {}), [key]: new Date().toISOString() };
  const { error } = await supabase.from("agencies").update({ settings: { ...settings, lifecycle } }).eq("id", agencyId);
  if (error) throw new Error(`Couldn't record ${key}: ${error.message}`);
}

async function send(payload) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM_EMAIL, replyTo: REPLY_TO, ...payload });
  if (error) throw new Error(error.message);
}

export async function sendWelcomeEmail({ agencyId, to, firstName, plan }) {
  if (!configured() || !to || !agencyId) return;
  try {
    const base = siteUrl();
    const label = planLabel(plan) || null;
    const props = {
      firstName: firstName || null,
      planLabel: label,
      isAgency: plan === "agency",
      analyseUrl: `${base}/analyse`,
      teamUrl: `${base}/dashboard/team`,
      importUrl: `${base}/dashboard/import`,
    };
    const html = await render(<WelcomeEmail {...props} />);
    const text = await render(<WelcomeEmail {...props} />, { plainText: true });
    await send({ to, subject: "Your Helixon workspace is ready", html, text });
    await markSent(agencyId, "welcomeSentAt");
  } catch (err) {
    console.error("[lifecycle-email] Welcome email failed:", err?.message);
  }
}

export function activationNudgeEmail({ firstName, agencyName }) {
  const url = `${siteUrl()}/analyse`;
  const hello = firstName ? `Hi ${firstName},` : "Hi,";
  const where = agencyName ? ` for ${agencyName}` : "";
  const text = [
    hello,
    "",
    `Your Helixon workspace${where} is set up, but nothing's been screened yet.`,
    "",
    "The quickest way to see what it does: open Analyse, paste the advert for a role you're working on, and drop in one CV. You'll have a score, the evidence behind it and what to ask at interview in under a minute.",
    "",
    `Screen your first CV: ${url}`,
    "",
    "If something's in the way, just reply and tell us. A person reads every reply.",
    "",
    "The Helixon team",
    "",
    "You're getting this once, because you created a Helixon workspace.",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#13201b;max-width:480px">
      <p>${escapeHtml(hello)}</p>
      <p>Your Helixon workspace${escapeHtml(where)} is set up, but nothing's been screened yet.</p>
      <p>The quickest way to see what it does: open Analyse, paste the advert for a role you're working on, and drop in one CV. You'll have a score, the evidence behind it and what to ask at interview in under a minute.</p>
      <p><a href="${url}" style="display:inline-block;background:#0b6e4f;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Screen your first CV</a></p>
      <p>If something's in the way, just reply and tell us. A person reads every reply.</p>
      <p>The Helixon team</p>
      <p style="font-size:11px;color:#587364">You're getting this once, because you created a Helixon workspace.</p>
    </div>`;
  return { subject: "Your first Helixon shortlist is one CV away", text, html };
}

// Called from the weekday reminders cron. Returns { sent, skipped }.
export async function sendActivationNudges(now = Date.now()) {
  if (!configured()) return { sent: 0, skipped: 0 };
  const from = new Date(now - NUDGE_UNTIL_DAYS * 86400000).toISOString();
  const to = new Date(now - NUDGE_AFTER_DAYS * 86400000).toISOString();
  const { data: agencies, error } = await supabase
    .from("agencies")
    .select("id, name, settings, created_at")
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(NUDGE_CAP);
  if (error) throw new Error(error.message);

  let sent = 0;
  let skipped = 0;
  const clerk = await clerkClient();
  for (const agency of agencies || []) {
    if (agency.settings?.lifecycle?.activationNudgeAt) { skipped++; continue; }
    try {
      const { count } = await supabase.from("candidates").select("id", { count: "exact", head: true }).eq("agency_id", agency.id);
      if (count > 0) { skipped++; continue; }
      const { data: owner } = await supabase
        .from("profiles")
        .select("clerk_user_id, first_name")
        .eq("agency_id", agency.id)
        .not("clerk_user_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!owner?.clerk_user_id) { skipped++; continue; }
      const user = await clerk.users.getUser(owner.clerk_user_id);
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) { skipped++; continue; }
      // Marked before sending: a missed nudge is better than a repeated one.
      await markSent(agency.id, "activationNudgeAt");
      await send({ to: email, ...activationNudgeEmail({ firstName: owner.first_name || user.firstName, agencyName: agency.name }) });
      sent++;
    } catch (err) {
      console.error("[lifecycle-email] Activation nudge failed:", err?.message);
      skipped++;
    }
  }
  return { sent, skipped };
}
