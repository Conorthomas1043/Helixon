// Best-effort email notifications for the firewall (lib/security/firewall.js).
// Never throws - a notification failure must never affect request logging
// or blocking, which is why every call site here wraps this in .catch(() => {}).

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Helixon Security <noreply@helixon.co.uk>";

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendFirewallAlert({ outcome, ip, path, method, country, city, userAgent, score, signals }) {
  const to = process.env.SECURITY_ALERT_EMAIL;
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
    console.error("[firewall-alert] Failed to send email:", err.message);
  }
}
