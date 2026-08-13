// app/api/trial/verify/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import WelcomeEmail from "@/emails/WelcomeEmail";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  if (!supabase) {
    return NextResponse.redirect(`${origin}/trial/check-email?error=server`);
  }
  if (!token) {
    return NextResponse.redirect(`${origin}/trial/check-email?error=missing`);
  }

  // Added `email` to the select — needed to send the welcome email below.
  // Wasn't selected before since nothing used it yet.
  const { data: verification, error: findErr } = await supabase
    .from("trial_verifications")
    .select("token, agency_id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (findErr) {
    console.error("[trial/verify] Lookup error:", findErr);
    return NextResponse.redirect(`${origin}/trial/check-email?error=server`);
  }

  if (!verification) {
    return NextResponse.redirect(`${origin}/trial/check-email?error=invalid`);
  }

  if (verification.used_at) {
    // Already-verified links redirect straight into the app rather than
    // erroring — someone clicking an old confirmation email a second
    // time (e.g. from an email client that pre-fetches links) shouldn't
    // see a scary "invalid link" message if they're already verified.
    // No welcome email here — it already went out the first time this
    // token was used, so a repeat click shouldn't fire a second one.
    return NextResponse.redirect(`${origin}/analyse`);
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/trial/check-email?error=expired`);
  }

  const { error: updateErr } = await supabase
    .from("trial_verifications")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  if (updateErr) {
    console.error("[trial/verify] Failed to mark token used:", updateErr);
    return NextResponse.redirect(`${origin}/trial/check-email?error=server`);
  }

  // Fire the welcome email now that verification has actually succeeded.
  // Best-effort: a failed send here should never block access, so this
  // is deliberately not awaited-and-checked the way the verification
  // update above is — a Resend hiccup shouldn't turn into a broken
  // login for someone who just proved they own the inbox.
  if (resend && verification.email) {
    resend.emails
      .send({
        from: "Helixon <hello@helixon.co.uk>",
        to: verification.email,
        subject: "You're verified — your 3 free analyses are ready",
        react: WelcomeEmail({
          email: verification.email,
          analyseUrl: `${origin}/analyse`,
        }),
      })
      .catch((err) => {
        console.error("[trial/verify] Welcome email send failed:", err);
      });
  } else if (!resend) {
    console.error("[trial/verify] Skipped welcome email — RESEND_API_KEY not configured.");
  }

  const res = NextResponse.redirect(`${origin}/analyse`);

  // This is the ONLY place the real access cookie gets set now —
  // moved here from trial/start, so access requires having actually
  // clicked a link delivered to the claimed inbox.
  res.cookies.set("helixon_trial", verification.agency_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}