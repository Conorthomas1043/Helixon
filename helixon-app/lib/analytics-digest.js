// The weekly analytics digest (app/api/cron/analytics-digest): last week's
// headline numbers for the agency against the week before, sent on Monday
// mornings to everyone who switched it on (Account > Notifications). Pure,
// so the content is tested without sending.

import { escapeHtml } from "./reminder-email";

// Off unless the person turned it on - unlike the follow-up reminder,
// this isn't about anything they need to act on.
export const DIGEST_PREF_KEY = "weeklyDigest";

export function digestEnabled(privateMetadata) {
  return privateMetadata?.[DIGEST_PREF_KEY] === true;
}

const count = (n) => Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const money = (n) => `£${count(n)}`;

function change(current, previous, format = count) {
  if (typeof current !== "number" || typeof previous !== "number") return "";
  const d = Math.round(current - previous);
  if (d === 0) return "no change";
  return `${d > 0 ? "up" : "down"} ${format(Math.abs(d))}`;
}

//   week:     { analysed, placed, fees, avgScore, shortlistRate, placementRate, stalled }
//   previous: same shape, for the week before (or null)
// Returns null when nothing happened in either week - no point emailing a
// page of zeros.
export function buildDigestEmail({ firstName, agencyName, week, previous, siteUrl, weekLabel }) {
  const quiet = (w) => !w || (w.analysed === 0 && w.placed === 0);
  if (quiet(week) && quiet(previous)) return null;

  const p = previous || {};
  const rows = [
    { label: "Candidates analysed", value: count(week.analysed), change: change(week.analysed, p.analysed) },
    { label: "Placements", value: count(week.placed), change: change(week.placed, p.placed) },
    { label: "Fees placed", value: money(week.fees), change: change(week.fees, p.fees, money) },
    { label: "Average match score", value: week.analysed ? String(week.avgScore) : "-", change: week.analysed && p.analysed ? change(week.avgScore, p.avgScore) : "" },
    { label: "Shortlist rate", value: week.analysed ? `${week.shortlistRate}%` : "-", change: week.analysed && p.analysed ? change(week.shortlistRate, p.shortlistRate, (n) => `${n} pts`) : "" },
  ];

  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const subject = `Your week in Helixon: ${week.analysed} analysed, ${week.placed} placed`;
  const who = agencyName ? ` for ${agencyName}` : "";

  const htmlRows = rows
    .map(
      (r) => `<tr><td style="padding:10px 0;border-top:1px solid #e3e8e5;color:#13201b">${escapeHtml(r.label)}</td>
<td style="padding:10px 0 10px 12px;border-top:1px solid #e3e8e5;text-align:right;white-space:nowrap"><strong style="color:#13201b">${escapeHtml(r.value)}</strong>${r.change ? `<br><span style="color:#587364;font-size:12px">${escapeHtml(r.change)} on the week before</span>` : ""}</td></tr>`
    )
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#13201b;max-width:560px">
<p>${escapeHtml(greeting)}</p>
<p>Here's how ${escapeHtml(weekLabel)} went${escapeHtml(who)}.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${htmlRows}</table>
${week.stalled > 0 ? `<p style="color:#92620f;font-size:13px">${week.stalled} ${week.stalled === 1 ? "candidate has" : "candidates have"} had no activity for 5+ days.</p>` : ""}
<p><a href="${escapeHtml(siteUrl)}/dashboard/analytics" style="display:inline-block;background:#0b6e4f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open analytics</a></p>
<p style="color:#587364;font-size:12px">You get this on Monday mornings because you switched on the weekly summary. Turn it off in <a href="${escapeHtml(siteUrl)}/account/notifications" style="color:#0b6e4f">Account &gt; Notifications</a>.</p>
</div>`;

  const text = [
    greeting,
    "",
    `Here's how ${weekLabel} went${who}.`,
    "",
    ...rows.map((r) => `- ${r.label}: ${r.value}${r.change ? ` (${r.change} on the week before)` : ""}`),
    ...(week.stalled > 0 ? ["", `${week.stalled} ${week.stalled === 1 ? "candidate has" : "candidates have"} had no activity for 5+ days.`] : []),
    "",
    `Analytics: ${siteUrl}/dashboard/analytics`,
    `Turn these emails off: ${siteUrl}/account/notifications`,
  ].join("\n");

  return { subject, html, text };
}
