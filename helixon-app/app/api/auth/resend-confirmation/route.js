import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Helixon <noreply@helixon.co.uk>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  // Same enumeration-safe shape as forgot-password - always 200/{ok:true}
  // whether or not the email has an account.
  const genericSuccess = () => NextResponse.json({ ok: true });

  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return genericSuccess();
    }

    // type: "magiclink", not "signup". generateLink's "signup" type
    // requires a password param - we don't have the person's original
    // password here, and don't want to risk silently overwriting it with
    // a placeholder just to satisfy the type. "magiclink" needs no
    // password, works whether the account is confirmed or not yet, and
    // Supabase confirms the email as a side effect of a successful
    // verifyOtp - same end result as the original signup link, no risk.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      if (error && !error.message?.toLowerCase().includes("not found") && !error.message?.toLowerCase().includes("user not found")) {
        console.error("[resend-confirmation] generateLink:", error?.message);
      }
      return genericSuccess();
    }

    // Same shape as the signup route's link - lands on your existing
    // /verify-email page, which just forwards whatever type it's given to
    // verifyOtp, so "magiclink" works without any changes on that end.
    const verificationUrl = new URL(
      `/verify-email?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&email=${encodeURIComponent(email)}`,
      request.url
    ).toString();

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: "Verify your Helixon account",
          html: `
            <p>Hi there,</p>
            <p>Here's a fresh link to verify your Helixon account:</p>
            <p style="margin: 24px 0;">
              <a href="${verificationUrl}" style="background:#0b6e4f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                Verify email
              </a>
            </p>
            <p>Or paste this link into your browser:</p>
            <p style="word-break:break-all;color:#5a7a6a;">${verificationUrl}</p>
            <p style="color:#8aaa9a;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
          `,
        });
      } catch (emailErr) {
        console.error("[resend-confirmation] Failed to send email:", emailErr);
      }
    } else {
      console.error("[resend-confirmation] RESEND_API_KEY is not set - email not sent.");
    }

    return genericSuccess();
  } catch (err) {
    console.error("[resend-confirmation] Error:", err.message);
    return genericSuccess();
  }
}