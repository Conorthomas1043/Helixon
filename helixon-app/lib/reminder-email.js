// The daily follow-up reminder (app/api/cron/reminders): one email per
// recruiter listing their follow-ups that are overdue or due today
// (lib/follow-ups.js). Pure, so the content is tested without sending.

import { escapeHtml } from "@/lib/format";

export { escapeHtml };
export const MAX_LISTED = 15;

// Recruiters can turn the reminder off (Account > Notifications). Stored
// on their Clerk user, not in the database. On unless set to false.
export const REMINDER_PREF_KEY = "followUpReminders";

export function remindersEnabled(privateMetadata) {
  return privateMetadata?.[REMINDER_PREF_KEY] !== false;
}

function dueText(item, timeZone) {
  if (!item.dueAt) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(item.dueAt);
  const d = new Date(dateOnly ? `${item.dueAt}T12:00:00Z` : item.dueAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { timeZone, day: "numeric", month: "short", ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }) });
}

function itemUrl(item, siteUrl) {
  if (item.kind === "check_in") return `${siteUrl}/dashboard/talent-pool?due=1`;
  if (item.kind === "interview") return `${siteUrl}/dashboard/interviews`;
  return `${siteUrl}/dashboard/candidates/${item.candidateId}`;
}

// `items`: this recruiter's overdue + due-today follow-ups. Returns null
// when there's nothing to send.
export function buildReminderEmail({ firstName, items, siteUrl, timeZone = "Europe/London" }) {
  const list = (items || []).filter((i) => i.when === "overdue" || i.when === "today");
  if (list.length === 0) return null;

  const overdue = list.filter((i) => i.when === "overdue").length;
  const today = list.length - overdue;
  const parts = [overdue && `${overdue} overdue`, today && `${today} due today`].filter(Boolean);
  const subject = `Follow-ups: ${parts.join(", ")}`;
  const shown = list.slice(0, MAX_LISTED);
  const more = list.length - shown.length;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const rows = shown
    .map((i) => {
      const tag = i.when === "overdue" ? `<span style="color:#b42318;font-weight:600">Overdue</span>` : `<span style="color:#92620f;font-weight:600">Today</span>`;
      const due = dueText(i, timeZone);
      return `<tr><td style="padding:10px 0;border-top:1px solid #e3e8e5">
<a href="${escapeHtml(itemUrl(i, siteUrl))}" style="color:#13201b;font-weight:600;text-decoration:none">${escapeHtml(i.label)}</a><br>
<span style="color:#4a6658;font-size:13px">${escapeHtml(i.candidateName)}${i.jobTitle ? ` · ${escapeHtml(i.jobTitle)}` : ""}</span>
</td><td style="padding:10px 0 10px 12px;border-top:1px solid #e3e8e5;text-align:right;white-space:nowrap;font-size:12px">${tag}${due ? `<br><span style="color:#587364">${escapeHtml(due)}</span>` : ""}</td></tr>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#13201b;max-width:560px">
<p>${escapeHtml(greeting)}</p>
<p>You have ${escapeHtml(parts.join(" and "))}.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table>
${more > 0 ? `<p style="color:#4a6658;font-size:13px">…and ${more} more.</p>` : ""}
<p><a href="${escapeHtml(siteUrl)}/dashboard" style="display:inline-block;background:#0b6e4f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open your dashboard</a></p>
<p style="color:#587364;font-size:12px">You get this on weekday mornings when follow-ups are due on candidates assigned to you. Turn it off in <a href="${escapeHtml(siteUrl)}/account/notifications" style="color:#0b6e4f">Account &gt; Notifications</a>.</p>
</div>`;

  const text = [
    greeting,
    "",
    `You have ${parts.join(" and ")}.`,
    "",
    ...shown.map((i) => `- [${i.when === "overdue" ? "Overdue" : "Today"}] ${i.label} - ${i.candidateName}${i.jobTitle ? ` (${i.jobTitle})` : ""}: ${itemUrl(i, siteUrl)}`),
    ...(more > 0 ? [`...and ${more} more.`] : []),
    "",
    `Dashboard: ${siteUrl}/dashboard`,
    `Turn these emails off: ${siteUrl}/account/notifications`,
  ].join("\n");

  return { subject, html, text, count: list.length };
}
