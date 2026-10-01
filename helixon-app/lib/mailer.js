// Email sent on an agency's behalf - interview invites, scorecard and
// reference requests, templates and sequences. From the agency's name at
// the Helixon sending address (RESEND_FROM_EMAIL); replies go to the
// recruiter who sent it.

import { Resend } from "resend";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { agencyDisplayName } from "@/lib/agency-display";

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
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
// Returns { id } or { error } - never throws.
export async function sendAgencyEmail({ agencyId, profile = null, to, subject, text, html, attachments, replyTo, fromName }) {
  if (!mailConfigured()) return { error: "Email isn't set up yet." };
  try {
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
      console.error("[mailer] Send failed:", error.message);
      return { error: "The email couldn't be sent." };
    }
    return { id: data?.id ?? null };
  } catch (err) {
    console.error("[mailer] Send failed:", err?.message);
    return { error: "The email couldn't be sent." };
  }
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
}
