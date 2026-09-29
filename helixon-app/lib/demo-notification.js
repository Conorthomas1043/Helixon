// lib/demo-notification.js
// The "new demo request" email the sales inbox gets. Shared by the demo
// form (app/api/demo-request) and the admin Leads page's "Resend
// notification", so a resend looks exactly like the original.

export const SALES_EMAIL = "sales@helixon.co.uk";
// Resend requires sending from a domain you've verified with them.
export const FROM_EMAIL = "Helixon <noreply@helixon.co.uk>";

export function escapeHtml(str = "") {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resend payload for the sales notification about one demo request. */
export function salesNotificationEmail({ name, email, company, message, utm_source, utm_medium, utm_campaign, referrer }, { resent = false } = {}) {
  return {
    from: FROM_EMAIL,
    to: SALES_EMAIL,
    replyTo: email,
    subject: `${resent ? "[Resent] " : ""}New demo request - ${name}${company ? ` (${company})` : ""}`,
    html: `
          <h2>New demo request</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Company:</strong> ${escapeHtml(company) || "-"}</p>
          <p><strong>What they're hoping to solve:</strong></p>
          <p>${escapeHtml(message) || "-"}</p>
          ${utm_source || referrer ? `
            <hr />
            <p style="color:#666;font-size:12px;">
              ${utm_source ? `Source: ${escapeHtml(utm_source)}<br/>` : ""}
              ${utm_medium ? `Medium: ${escapeHtml(utm_medium)}<br/>` : ""}
              ${utm_campaign ? `Campaign: ${escapeHtml(utm_campaign)}<br/>` : ""}
              ${referrer ? `Referrer: ${escapeHtml(referrer)}<br/>` : ""}
            </p>
          ` : ""}
        `,
  };
}
