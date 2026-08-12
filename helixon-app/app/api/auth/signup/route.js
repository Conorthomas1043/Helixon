import { supabase } from "@/lib/supabase"; // service-role client, bypasses RLS
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export async function POST(request) {
  try {
    const body = await request.json();
    const firstName = (body?.firstName || "").trim();
    const lastName = (body?.lastName || "").trim();
    const username = (body?.username || "").trim().toLowerCase();
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";
    const agencyName = (body?.agencyName || "").trim();

    // ── Server-side validation — never trust the client's step gating ─────
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
      // Likely the unique constraint on intake_email — someone already
      // started a trial or signed up with this email.
      if (agencyError.code === "23505") {
        return NextResponse.json({ ok: false, error: "An account already exists for this email." }, { status: 409 });
      }
      throw new Error(agencyError.message);
    }

    // ── Create the auth user via the anon-key SSR client, so Supabase
    //    handles the confirmation email and sets the session cookie itself.
    //    Pass ALL profile fields via user_metadata — a database trigger on
    //    auth.users (see profile_trigger.sql) creates the profiles row
    //    inside the same transaction, so there's no race condition between
    //    signUp() completing and a separate service-role insert. ──────────
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );

    const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
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

    if (signUpError) {
      // Roll back the agency row so a failed signup doesn't leave orphan data
      await supabase.from("agencies").delete().eq("id", agency.id);

      // The trigger enforces the same unique username constraint — surface
      // that specific case with the same friendly message as before.
      if (signUpError.message?.includes("duplicate key") && signUpError.message?.includes("username")) {
        return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: signUpError.message }, { status: 400 });
    }

    const user = signUpData?.user;
    if (!user) {
      await supabase.from("agencies").delete().eq("id", agency.id);
      return NextResponse.json({ ok: false, error: "Signup failed. Please try again." }, { status: 500 });
    }

    // If email confirmation is required, Supabase returns a user but no
    // active session — signUpData.session will be null in that case.
    // The frontend treats `!data.user` as "check your email"; since we
    // always have `user` here, check session instead and surface the same
    // UX signal by nulling `user` in the response when unconfirmed.
    const emailConfirmationRequired = !signUpData.session;

    return NextResponse.json({
      ok: true,
      user: emailConfirmationRequired ? null : { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error("[signup] Error:", err.message);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}