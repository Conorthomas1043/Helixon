// Best-effort email notifications for the firewall (lib/security/firewall.js).
// Never throws - a notification failure must never affect request logging
// or blocking, which is why every call site wraps this in .catch(reportQuietly).

import "server-only";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/format";
import { reportError } from "@/lib/report-error";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Helixon Security <noreply@helixon.co.uk>";

// `to`: the recipients set on the admin Security page (lib/site-settings.js
// alertRecipients); falls back to SECURITY_ALERT_EMAIL.
export async function sendFirewallAlert({ outcome, ip, path, method, country, city, userAgent, score, signals, to: recipients }) {
  const to = recipients?.length ? recipients : process.env.SECURITY_ALERT_EMAIL;
  if (!to || !process.env.RESEND_API_KEY) return;

  const blocked = outcome === "blocked";
  const location = [city, country].filter(Boolean).join(", ") || "Unknown location";

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: blocked
        ? `Firewall blocked ${ip} (score ${score})`
        : `Suspicious activity from ${ip} (score ${score})`,
      html: `
        <h2>${blocked ? "Request blocked automatically" : "Suspicious request flagged"}</h2>
        <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
        <p><strong>Location:</strong> ${escapeHtml(location)}</p>
        <p><strong>Request:</strong> ${escapeHtml(method)} ${escapeHtml(path)}</p>
        <p><strong>User-agent:</strong> ${escapeHtml(userAgent || "-")}</p>
        <p><strong>Threat score:</strong> ${score}/100</p>
        <p><strong>Signals:</strong> ${escapeHtml((signals || []).join(", ") || "-")}</p>
        <p>${
          blocked
            ? "This IP has been added to the block list automatically. Every further request from it is denied until an admin removes the block from /admin/security."
            : "This is below the auto-block threshold, so nothing was blocked. Review it in /admin/pentester and block manually if it looks malicious."
        }</p>
      `,
    });
  } catch (err) {
    reportError("[firewall-alert] Failed to send email:", err.message);
  }
}

/**
 * A plain admin alert (the daily health check, for now). Never throws;
 * resolves true when the email was handed to Resend.
 */
export async function sendAdminAlert({ to, subject, html }) {
  if (!to?.length || !process.env.RESEND_API_KEY) return false;
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    return true;
  } catch (err) {
    reportError("[admin-alert] Failed to send email:", err.message);
    return false;
  }
}

export { escapeHtml };
