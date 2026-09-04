import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Helixon <noreply@helixon.co.uk>";

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isStrongPassword(pw) {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[!@#$%^&*()\-_=+\[\]{};':",.<>?]/.test(pw)
  );
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const firstName = (body?.firstName || "").trim();
    const lastName = (body?.lastName || "").trim();
    const username = (body?.username || "").trim().toLowerCase();
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";
    const agencyName = (body?.agencyName || "").trim();

    // ── Server-side validation - never trust the client's step gating ─────
    if (!firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "First and last name are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ ok: false, error: "Username must be 3–20 characters, start with a letter, letters/numbers/underscores only." }, { status: 400 });
    }
    if (!isStrongPassword(password)) {
      return NextResponse.json({ ok: false, error: "Password doesn't meet the strength requirements." }, { status: 400 });
    }
    if (!agencyName) {
      return NextResponse.json({ ok: false, error: "Agency name is required." }, { status: 400 });
    }

    // ── Re-check username uniqueness server-side (client check is UX only) ─
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
    }

    // ── Create the agency row first ────────────────────────────────────────
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .insert({
        name: agencyName,
        intake_email: email,
        settings: { plan: body?.plan || "solo", analyses_used: 0 },
      })
      .select("id")
      .single();

    if (agencyError) {
      // Likely the unique constraint on intake_email - someone already
      // started a trial or signed up with this email.
      if (agencyError.code === "23505") {
        // FIX: was "Error try another email" - not actually a sentence, and
        // didn't tell the person what happened or what to do next.
        return NextResponse.json({ ok: false, error: "An account already exists for this email. Try logging in instead." }, { status: 409 });
      }
      throw new Error(agencyError.message);
    }

    // ── Create the auth user via admin.generateLink() instead of the
    //    anon-key signUp(). generateLink() creates the user (still
    //    unconfirmed) AND returns the verification action link - but,
    //    unlike signUp(), it does NOT trigger Supabase's own confirmation
    //    email. That lets us send the email ourselves via Resend, in the
    //    same branded template as the rest of the app, instead of
    //    Supabase's default mailer/template.
    //
    //    The profile_trigger.sql trigger on auth.users still fires here
    //    exactly as before, since generateLink() performs a real insert
    //    into auth.users under the hood. ─────────────────────────────────
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          username,
          agency_id: agency.id,
        },
      },
    });

    if (linkError) {
      // Roll back the agency row so a failed signup doesn't leave orphan data
      await supabase.from("agencies").delete().eq("id", agency.id);

      // The trigger enforces the same unique username constraint - surface
      // that specific case with the same friendly message as before.
      if (linkError.message?.includes("duplicate key") && linkError.message?.includes("username")) {
        return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
      }
      if (linkError.message?.toLowerCase().includes("already registered")) {
        return NextResponse.json({ ok: false, error: "An account already exists for this email." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: linkError.message }, { status: 400 });
    }

    const user = linkData?.user;
    const tokenHash = linkData?.properties?.hashed_token;

    if (!user || !tokenHash) {
      await supabase.from("agencies").delete().eq("id", agency.id);
      return NextResponse.json({ ok: false, error: "Signup failed. Please try again." }, { status: 500 });
    }

    // FIX: was linkData.properties.action_link, which points at Supabase's
    // own hosted /auth/v1/verify endpoint - clicking it never reaches our
    // /verify-email page at all, so the verifyOtp POST route never gets
    // called. Building our own link from the raw hashed_token keeps the
    // whole flow on our domain and actually reaches that route.
    // Also includes email - /verify-email's resend button needs it and
    // has nowhere else to get it from.
    const verificationUrl = new URL(
      `/verify-email?token_hash=${encodeURIComponent(tokenHash)}&type=signup&email=${encodeURIComponent(email)}`,
      request.url
    ).toString();

    // ── Send the verification email ourselves via Resend ───────────────────
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: "Verify your Helixon account",
          html: `
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>Thanks for signing up for Helixon. Click the button below to verify your email and activate your account:</p>
            <p style="margin: 24px 0;">
              <a href="${verificationUrl}" style="background:#0b6e4f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                Verify email
              </a>
            </p>
            <p>Or paste this link into your browser:</p>
            <p style="word-break:break-all;color:#5a7a6a;">${verificationUrl}</p>
            <p style="color:#8aaa9a;font-size:12px;">If you didn't create a Helixon account, you can ignore this email.</p>
          `,
        });
      } catch (emailErr) {
        // Don't fail the signup over a delivery hiccup - the account and
        // agency both exist; a resend-verification flow can retry later.
        console.error("[signup] Failed to send verification email:", emailErr);
      }
    } else {
      console.error("[signup] RESEND_API_KEY is not set - verification email not sent.");
    }

    // generateLink() never returns an active session (unlike signUp()),
    // so email confirmation is always required here - no session cookie
    // to set. Frontend already treats `user: null` as "check your email".
    return NextResponse.json({ ok: true, user: null });
  } catch (err) {
    console.error("[signup] Error:", err.message);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}