// Emails for compliance: the agency's privacy notice to a candidate, and a
// reference request to a referee. Plain text, from the agency, replies to
// the recruiter (lib/mailer.js).

import "server-only";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidates/activity";
import { agencyNotice } from "@/lib/public-jobs";
import { sendAgencyEmail, siteUrl } from "@/lib/mailer";

export function privacyNoticeEmail({ agencyName, firstName, notice, noticeUrl, recruiterName }) {
  return {
    subject: `How ${agencyName} uses your details`,
    text: [
      `Hi${firstName ? ` ${firstName}` : ""},`,
      "",
      `We've added your details to ${agencyName}'s candidate records so we can let you know about roles that may suit you. The law asks us to tell you how we use your information, so here it is:`,
      "",
      notice,
      ...(noticeUrl ? ["", `You can also read this online: ${noticeUrl}`] : []),
      "",
      "If you'd rather we didn't keep your details, just reply to this email and we'll delete them.",
      "",
      [recruiterName, agencyName].filter(Boolean).join("\n"),
    ].join("\n"),
  };
}

export function referenceRequestEmail({ agencyName, refereeName, candidateName, url, recruiterName, reminder = false }) {
  return {
    subject: `${reminder ? "Reminder: " : ""}Reference for ${candidateName}`,
    text: [
      `Hi${refereeName ? ` ${refereeName.split(" ")[0]}` : ""},`,
      "",
      `${candidateName} has given your name as a referee, and we're helping them with a new role. Could you spare five minutes to give a reference? There's no account to create:`,
      "",
      url,
      "",
      "If you'd rather not, or can't give one, you can say so on the same page.",
      "",
      "Thank you,",
      [recruiterName, agencyName].filter(Boolean).join("\n"),
    ].join("\n"),
  };
}

export function referenceUrl(token) {
  return `${siteUrl()}/reference/${token}`;
}

// Sends the agency's privacy notice to each candidate with an email and
// records it. Returns { sent, skipped, failed }.
export async function sendPrivacyNotices({ agencyId, profile, actor, recruiterName, candidates }) {
  const { data: agency } = await supabase.from("agencies").select("id, name, settings, careers_slug, careers_enabled").eq("id", agencyId).maybeSingle();
  const notice = agencyNotice(agency || {});
  const noticeUrl = agency?.careers_enabled && agency?.careers_slug ? `${siteUrl()}/jobs/${agency.careers_slug}/privacy` : null;
  const agencyName = agency?.name || "Our agency";
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const c of candidates) {
    if (!c.email) {
      skipped++;
      continue;
    }
    const name = c.full_name || c.name || "";
    const mail = privacyNoticeEmail({ agencyName, firstName: name.split(" ")[0], notice, noticeUrl, recruiterName });
    const res = await sendAgencyEmail({ agencyId, profile, to: c.email, subject: mail.subject, text: mail.text });
    if (res.error) {
      failed++;
      continue;
    }
    sent++;
    await supabase.from("candidates").update({ privacy_notice_sent_at: new Date().toISOString() }).eq("id", c.id).eq("agency_id", agencyId);
    await logActivity(supabase, c.id, "privacy_notice_sent", actor, { note: `Emailed to ${c.email}` });
  }
  return { sent, skipped, failed };
}
