import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Service-role client - server-side only, never exposed to the browser.
// Bypasses RLS, which is fine here since this route is the only writer.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALES_EMAIL = "sales@helixon.co.uk";
// Resend requires sending from a domain you've verified with them.
// Swap this for your verified sending address/domain.
const FROM_EMAIL = "Helixon <noreply@helixon.co.uk>";

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clean(val, maxLen = 300) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (name.length > 200 || company.length > 200 || message.length > 5000) {
    return NextResponse.json({ ok: false, error: "One of the fields is too long." }, { status: 400 });
  }

  // Attribution - sent from the client, captured from URL query params
  // and document.referrer at the point of submit.
  const utm_source = clean(body?.utm_source);
  const utm_medium = clean(body?.utm_medium);
  const utm_campaign = clean(body?.utm_campaign);
  const utm_term = clean(body?.utm_term);
  const utm_content = clean(body?.utm_content);
  const referrer = clean(body?.referrer, 500);

  // Persist first - a request should never be lost even if Resend has
  // an outage. Email delivery is best-effort on top of this.
  let insertedId = null;
  try {
    const { data, error: dbError } = await supabase
      .from("demo_requests")
      .insert({
        name,
        email,
        company: company || null,
        message: message || null,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        referrer,
      })
      .select("id")
      .single();

    if (dbError) throw dbError;
    insertedId = data?.id ?? null;
  } catch (err) {
    console.error("Failed to save demo request:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong saving your request. Please try again." },
      { status: 500 }
    );
  }

  // Email is best-effort - if it fails, the request is still saved and
  // visible in Supabase, so we don't fail the whole submission for it.
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: SALES_EMAIL,
        replyTo: email,
        subject: `New demo request - ${name}${company ? ` (${company})` : ""}`,
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
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "We've got your demo request",
        html: `
          <p>Hi ${escapeHtml(name.split(" ")[0])},</p>
          <p>Thanks for your interest in Helixon - someone from our team will reach out within one business day to find a time that works.</p>
          <p>In the meantime, feel free to reply directly to this email with any questions.</p>
          <p>- The Helixon team</p>
        `,
      });

      emailSent = true;
    } catch (err) {
      console.error("Failed to send demo request email:", err);
      // Don't fail the request - it's already saved.
    }
  } else {
    console.error("RESEND_API_KEY is not set - demo request email not sent.");
  }

  if (emailSent && insertedId) {
    // Fire-and-forget status update; doesn't affect the response either way.
    supabase
      .from("demo_requests")
      .update({ email_sent: true })
      .eq("id", insertedId)
      .then(({ error }) => {
        if (error) console.error("Failed to mark demo request as emailed:", error);
      });
  }

  return NextResponse.json({ ok: true });
}