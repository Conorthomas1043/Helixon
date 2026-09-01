import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Helixon <noreply@helixon.co.uk>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  // Always the same 200/{ok:true} response, whether or not this email has
  // an account, whether the email send fails, or anything else goes wrong -
  // this endpoint must never let someone learn which emails are registered
  // by watching the response. Your frontend already expects this (it shows
  // "check your inbox" unconditionally on res.ok).
  const genericSuccess = () => NextResponse.json({ ok: true });

  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return genericSuccess();
    }

    // generateLink(type: "recovery") creates a one-time recovery token
    // without sending Supabase's own reset email, mirroring how signup
    // uses generateLink() + Resend for branded emails instead of Supabase's
    // default template.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    // generateLink() errors when there's no account for this email. Log it
    // for your own visibility, but the response to the client must stay
    // identical either way.
    if (error || !data?.properties?.hashed_token) {
      if (error && !error.message?.toLowerCase().includes("not found") && !error.message?.toLowerCase().includes("user not found")) {
        console.error("[forgot-password] generateLink:", error?.message);
      }
      return genericSuccess();
    }

    // Our own link, not Supabase's hosted action_link - lands on our
    // /reset-password page, which verifies the token_hash itself via the
    // same verifyOtp route used for signup confirmation (type differs).
    const resetUrl = new URL(
      `/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
      request.url
    ).toString();

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: "Reset your Helixon password",
          html: `
            <p>Hi there,</p>
            <p>We received a request to reset the password for your Helixon account. Click below to choose a new one:</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background:#0b6e4f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                Reset password
              </a>
            </p>
            <p>Or paste this link into your browser:</p>
            <p style="word-break:break-all;color:#5a7a6a;">${resetUrl}</p>
            <p style="color:#8aaa9a;font-size:12px;">This link expires shortly and can only be used once. If you didn't request a password reset, you can safely ignore this email.</p>
          `,
        });
      } catch (emailErr) {
        console.error("[forgot-password] Failed to send email:", emailErr);
      }
    } else {
      console.error("[forgot-password] RESEND_API_KEY is not set - reset email not sent.");
    }

    return genericSuccess();
  } catch (err) {
    console.error("[forgot-password] Error:", err.message);
    return genericSuccess();
  }
}