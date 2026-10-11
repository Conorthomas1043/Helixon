import { NextResponse } from "next/server";
import { recordSignal } from "@/lib/analytics/research-signals";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { cleanText, cleanLine } from "@/lib/sanitize";
import { featureOffResponse, isFeatureEnabled } from "@/lib/ops/site-settings";
import { FROM_EMAIL, escapeHtml, salesNotificationEmail } from "@/lib/messaging/demo-notification";
import { reportError } from "@/lib/report-error";
import { fields, flag, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const DemoRequestInput = fields({
  name: text(400),
  email: text(320),
  company: text(400),
  message: text(10000),
  researchOptIn: flag,
  referrer: text(2000),
  utm_source: text(200),
  utm_medium: text(200),
  utm_campaign: text(200),
  utm_term: text(200),
  utm_content: text(200),
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Service-role client - server-side only, never exposed to the browser.
// Bypasses RLS, which is fine here since this route is the only writer.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(val, maxLen = 300) {
  return cleanLine(val, maxLen) || null;
}

export async function POST(request) {
  if (!(await isFeatureEnabled("demo_requests"))) {
    return featureOffResponse("Demo bookings are paused for the moment. Please email hello@helixon.co.uk and we'll set one up.");
  }
  if (!(await rateLimit(`demo:${getClientIp(request)}`, 10))) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = await parseBody(request, DemoRequestInput, { respond: (status, error) => NextResponse.json({ ok: false, error }, { status }) });
  if (parsed.response) return parsed.response;
  const body = parsed.body;

  const name = cleanLine(body?.name, 200);
  const email = cleanLine(body?.email, 254);
  const company = cleanLine(body?.company, 200);
  const message = cleanText(body?.message, { max: 5000 });

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
    // An opt-in to research invitations, ticked by the person on the form.
    if (body?.researchOptIn === true) {
      await recordSignal({ kind: "research_optin", label: "demo_request", meta: { demoRequestId: insertedId } });
    }
  } catch (err) {
    reportError("Failed to save demo request:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong saving your request. Please try again." },
      { status: 500 }
    );
  }

  // Email is best-effort - if it fails, the request is still saved and
  // visible in Supabase, so we don't fail the whole submission for it.
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    // The Resend SDK reports a failed send as { error }, not by throwing.
    // email_sent records the sales notification; the visitor's
    // confirmation is a courtesy and only reported if it fails.
    try {
      const { error: notifyError } = await resend.emails.send(
        salesNotificationEmail({ name, email, company, message, utm_source, utm_medium, utm_campaign, referrer }),
      );
      if (notifyError) throw new Error(notifyError.message);
      emailSent = true;

      const { error: replyError } = await resend.emails.send({
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
      if (replyError) reportError("Failed to send demo request confirmation:", replyError.message);
    } catch (err) {
      reportError("Failed to send demo request email:", err);
      // Don't fail the request - it's already saved.
    }
  } else {
    reportError("RESEND_API_KEY is not set - demo request email not sent.");
  }

  if (emailSent && insertedId) {
    // Awaited: a serverless function can be frozen as soon as it responds.
    // Doesn't affect the response either way.
    const { error } = await supabase.from("demo_requests").update({ email_sent: true }).eq("id", insertedId);
    if (error) reportError("Failed to mark demo request as emailed:", error);
  }

  return NextResponse.json({ ok: true });
}