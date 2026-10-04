// Sending an email to a candidate (or client contact) that's kept on their
// record (email_messages) and logged on their timeline. When inbound mail
// is set up (RESEND_INBOUND_DOMAIN, with an "email.received" webhook to
// /api/webhooks/resend-inbound), each message gets its own Reply-To -
// reply+<token>@<domain> - so replies land back on the candidate's thread
// and are forwarded on to the recruiter. Without it, replies go straight to
// the recruiter as before.

import "server-only";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidates/activity";
import { sendAgencyEmail, senderEmail } from "@/lib/mailer";

export function inboundDomain() {
  const d = (process.env.RESEND_INBOUND_DOMAIN || "").trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

export function replyAddress(token, domain = inboundDomain()) {
  return domain ? `reply+${token}@${domain}` : null;
}

// The token from an inbound "to" address, or null.
export function tokenFromAddress(address, domain = inboundDomain()) {
  if (!domain) return null;
  const m = String(address || "").toLowerCase().match(/reply\+([a-f0-9]{32})@([a-z0-9.-]+)/);
  return m && m[2] === domain ? m[1] : null;
}

// { agencyId, profile, actor, sentBy (clerk id), candidateId?, clientId?,
//   to, subject, body, templateId?, enrollmentId?, recruiterEmail? }
// Returns { messageId } or { error }.
export async function sendTrackedEmail(opts) {
  const token = crypto.randomBytes(16).toString("hex");
  const recruiterEmail = opts.recruiterEmail === undefined ? await senderEmail() : opts.recruiterEmail;
  const replyTo = replyAddress(token) || recruiterEmail || null;

  const res = await sendAgencyEmail({
    agencyId: opts.agencyId,
    profile: opts.profile,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
    replyTo,
    fromName: opts.fromName,
  });
  if (res.error) return { error: res.error };

  const { data: message } = await supabase
    .from("email_messages")
    .insert({
      agency_id: opts.agencyId,
      candidate_id: opts.candidateId ?? null,
      client_id: opts.clientId ?? null,
      direction: "out",
      from_email: recruiterEmail,
      to_email: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
      subject: opts.subject,
      body_text: opts.body,
      provider_id: res.id,
      reply_token: token,
      template_id: opts.templateId ?? null,
      enrollment_id: opts.enrollmentId ?? null,
      sent_by: opts.sentBy ?? null,
    })
    .select("id")
    .single();

  // "email_logged" so it counts with the rest of their outreach in
  // Analytics, the same as app/api/send-email.
  if (opts.candidateId) {
    await logActivity(supabase, opts.candidateId, "email_logged", opts.actor || "Helixon", {
      note: `Sent from Helixon to ${Array.isArray(opts.to) ? opts.to.join(", ") : opts.to}: "${opts.subject}"`,
      sent_via: opts.enrollmentId ? "sequence" : "helixon",
    });
  }
  return { messageId: message?.id ?? null };
}
