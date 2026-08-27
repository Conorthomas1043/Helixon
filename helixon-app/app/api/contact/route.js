import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Map the form's "topic" select values to the right inbox.
// Keep these in sync with the <select> options in contact/page.jsx.
const TOPIC_ROUTING = {
  "Support": "support@helixon.co.uk",
  "Sales & pricing": "sales@helixon.co.uk",
  "Something else": "hello@helixon.co.uk",
};

const FROM_NOTIFICATION = "Helixon Contact Form <contact@helixon.co.uk>"; // must be a verified sending domain in Resend
const FROM_AUTOREPLY = "Helixon <noreply@helixon.co.uk>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body?.name || "").toString().trim();
  const email = (body?.email || "").toString().trim();
  const topic = (body?.topic || "Something else").toString().trim();
  const message = (body?.message || "").toString().trim();

  if (!name || !email || !message) {
    return Response.json({ error: "Name, email, and message are required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (message.length > 5000) {
    return Response.json({ error: "Message is too long." }, { status: 400 });
  }

  const to = TOPIC_ROUTING[topic] || TOPIC_ROUTING["Something else"];

  try {
    // 1) Internal notification to the right team inbox
    await resend.emails.send({
      from: FROM_NOTIFICATION,
      to,
      reply_to: email,
      subject: `New contact form message - ${topic} - ${name}`,
      html: internalNotificationHtml({ name, email, topic, message }),
    });

    // 2) Automated "we'll get back to you" reply to the sender
    await resend.emails.send({
      from: FROM_AUTOREPLY,
      to: email,
      subject: "We've got your message - Helixon",
      html: autoReplyHtml({ name }),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed:", err);
    return Response.json({ error: "Couldn't send your message. Please try again." }, { status: 502 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Email templates - table-based HTML for client compatibility, styled to
// match the Helixon landing page (forest green / mint / mist palette).
// ─────────────────────────────────────────────────────────────────────────

const COLORS = {
  forest: "#0b6e4f",
  forestDeep: "#0b3a2a",
  mint: "#e3f3ec",
  mist: "#f5f8f6",
  ink: "#13201b",
  inkSoft: "#5a7a6a",
  inkFaint: "#8aaa9a",
  border: "#e1e8e3",
};

function emailShell({ preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Helixon</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.mist};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${COLORS.mist};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.mist};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${COLORS.border};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:32px;height:32px;background:${COLORS.forest};border-radius:9px;text-align:center;vertical-align:middle;">
                      <span style="color:#ffffff;font-weight:700;font-size:14px;">H</span>
                    </td>
                    <td style="padding-left:10px;">
                      <span style="font-size:14px;font-weight:600;color:${COLORS.ink};">Helixon</span><br/>
                      <span style="font-size:9px;color:${COLORS.inkFaint};">Screen candidates in seconds</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.mist};">
                <p style="margin:0;font-size:11px;color:${COLORS.inkFaint};">© ${new Date().getFullYear()} Helixon. Screen candidates in seconds.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function internalNotificationHtml({ name, email, topic, message }) {
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td style="background:${COLORS.mint};color:${COLORS.forest};font-size:10px;font-weight:600;padding:5px 12px;border-radius:999px;">${escapeHtml(topic)}</td></tr>
    </table>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:${COLORS.ink};">New contact form message</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="padding:4px 0;font-size:12px;color:${COLORS.inkFaint};width:70px;">From</td>
        <td style="padding:4px 0;font-size:13px;color:${COLORS.ink};font-weight:600;">${escapeHtml(name)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:${COLORS.inkFaint};">Email</td>
        <td style="padding:4px 0;font-size:13px;color:${COLORS.forest};"><a href="mailto:${escapeHtml(email)}" style="color:${COLORS.forest};text-decoration:none;">${escapeHtml(email)}</a></td>
      </tr>
    </table>
    <div style="background:${COLORS.mist};border:1px solid ${COLORS.border};border-radius:10px;padding:16px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.ink};white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
    <a href="mailto:${escapeHtml(email)}" style="display:inline-block;margin-top:20px;background:${COLORS.forest};color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:10px;text-decoration:none;">Reply to ${escapeHtml(name.split(" ")[0] || "sender")}</a>
  `;
  return emailShell({ preheader: `${topic} - ${message.slice(0, 80)}`, bodyHtml: body });
}

function autoReplyHtml({ name }) {
  const firstName = escapeHtml((name || "").split(" ")[0] || "there");
  const body = `
    <div style="width:44px;height:44px;background:${COLORS.mint};border-radius:12px;text-align:center;line-height:44px;margin-bottom:20px;">
      <span style="font-size:20px;">✓</span>
    </div>
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:${COLORS.ink};">Thanks, ${firstName} - we've got it.</h1>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:${COLORS.inkSoft};">
      Your message has been sent to the right team at Helixon. We usually reply within a day -
      we'll get back to you soon.
    </p>
    <div style="background:${COLORS.mist};border:1px solid ${COLORS.border};border-radius:10px;padding:16px;margin-bottom:8px;">
      <p style="margin:0;font-size:12px;color:${COLORS.inkFaint};">In the meantime, you can explore Helixon:</p>
      <a href="https://www.helixon.co.uk" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:${COLORS.forest};text-decoration:none;">Visit helixon.co.uk →</a>
    </div>
  `;
  return emailShell({ preheader: "We usually reply within a day.", bodyHtml: body });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}