// app/api/trial/start/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import VerifyEmail from "@/emails/VerifyEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.error(
    "[trial/start] Missing Supabase env vars - NEXT_PUBLIC_SUPABASE_URL:",
    !!SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY:",
    !!SUPABASE_SERVICE_ROLE_KEY
  );
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
if (!RESEND_API_KEY) {
  console.error("[trial/start] Missing RESEND_API_KEY - verification emails cannot be sent.");
}

export async function POST(req) {
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Server is misconfigured (missing Supabase credentials)." },
      { status: 500 }
    );
  }

  // Without Resend configured, there's no way to deliver the verification
  // link at all - fail clearly instead of silently granting unverified
  // access (which is the exact problem this change is meant to fix).
  if (!resend) {
    return NextResponse.json(
      { ok: false, error: "Email delivery is temporarily unavailable. Please try again shortly." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = (body?.email || "").trim().toLowerCase();
  const marketingOptIn = !!body?.marketingOptIn;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  let agencyId;

  const { data: existing, error: findErr } = await supabase
    .from("agencies")
    .select("id")
    .eq("intake_email", email)
    .maybeSingle();

  if (findErr) {
    console.error("[trial/start] Supabase find error:", findErr);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again.", debug: process.env.NODE_ENV !== "production" ? findErr.message : undefined },
      { status: 500 }
    );
  }

  if (existing) {
    agencyId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("agencies")
      .insert({
        intake_email: email,
        name: email.split("@")[0],
        settings: { marketing_opt_in: marketingOptIn, plan: "trial", analyses_used: 0 },
      })
      .select("id")
      .single();

    if (createErr) {
      console.error("[trial/start] Supabase insert error:", createErr);
      return NextResponse.json(
        { ok: false, error: "Something went wrong. Please try again.", debug: process.env.NODE_ENV !== "production" ? createErr.message : undefined },
        { status: 500 }
      );
    }
    agencyId = created.id;
  }

  // Create a fresh verification token every time - even for a repeat
  // submission of an already-registered email. This doubles as a
  // "resend the link" mechanism: resubmitting the trial gate form just
  // issues a new token/email rather than needing a separate resend flow.
  const { data: verification, error: tokenErr } = await supabase
    .from("trial_verifications")
    .insert({ agency_id: agencyId, email })
    .select("token")
    .single();

  if (tokenErr) {
    console.error("[trial/start] Failed to create verification token:", tokenErr);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again.", debug: process.env.NODE_ENV !== "production" ? tokenErr.message : undefined },
      { status: 500 }
    );
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  const verifyUrl = `${origin}/api/trial/verify?token=${verification.token}`;

  try {
    await resend.emails.send({
      from: "Helixon <hello@helixon.co.uk>",
      to: email,
      subject: "Confirm your email to start your free trial",
      react: VerifyEmail({ email, verifyUrl }),
    });
  } catch (emailErr) {
    console.error("[trial/start] Resend send failed:", emailErr);
    // This one DOES matter for the response - if the email genuinely
    // couldn't be sent, the user has no way to get in, so tell them
    // rather than showing a false-success "check your email" screen.
    return NextResponse.json(
      { ok: false, error: "We couldn't send the confirmation email. Please try again." },
      { status: 502 }
    );
  }

  // No access cookie is set here anymore - that now only happens in
  // /api/trial/verify, once the link has actually been clicked.
  return NextResponse.json({ ok: true, redirectTo: "/trial/check-email" });
}