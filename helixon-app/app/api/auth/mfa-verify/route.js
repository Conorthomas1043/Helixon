import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_MFA_FAILURES = 5;

// Requires: migration-mfa-attempts.sql applied to the project (creates
// public.mfa_attempts). Mirrors the same fail-open, same-window pattern as
// checkRateLimit()/recordAttempt() in /api/auth/login - this route
// previously had zero brute-force protection on the 6-digit code.
async function checkMfaRateLimit(userId) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const { count } = await supabaseAdmin
      .from("mfa_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("success", false)
      .gte("created_at", since);

    if ((count || 0) >= MAX_MFA_FAILURES) {
      return { blocked: true, reason: "Too many incorrect codes. Please try again in a few minutes." };
    }
    return { blocked: false };
  } catch (e) {
    console.error("[mfa-verify] Rate limit check failed (failing open):", e.message);
    return { blocked: false };
  }
}

async function recordMfaAttempt(userId, success) {
  try {
    await supabaseAdmin.from("mfa_attempts").insert({ user_id: userId, success });
  } catch (e) {
    console.error("[mfa-verify] Failed to record MFA attempt:", e.message);
  }
}

// Applies the exact cookies Supabase's setAll gave us (name, value, AND its
// own options) onto the outgoing response. Never reconstruct these by hand -
// Supabase's options carry maxAge/expires/domain/sameSite that a hardcoded
// object will silently drop.
//
// `persist` mirrors the same option in /api/auth/login - the AAL2 cookies
// set here on MFA success need to honor the same rememberMe choice the
// person made on the credentials step, or a "remember me" login would get
// silently downgraded back to a session-only cookie the moment MFA kicks
// in.
function applyCookies(response, cookiesToSet, persist = true) {
  cookiesToSet.forEach(({ name, value, options }) => {
    const finalOptions = persist ? options : { ...options, maxAge: undefined, expires: undefined };
    response.cookies.set(name, value, finalOptions);
  });
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { factorId, code } = body;
    const rememberMe = !!body?.rememberMe;
    if (!factorId || !code) {
      return NextResponse.json({ ok: false, error: "Verification code is required." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
    }

    const cookieStore = await cookies();

    // Capture exactly what Supabase wants set, with its own options, so we
    // can replay it onto whichever NextResponse we end up returning below.
    let pendingCookies = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            pendingCookies = cookiesToSet;
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // response-level set via applyCookies() below is what
                // actually matters for the client.
              }
            });
          },
        },
      }
    );

    // Must run against the AAL1 session set by /api/auth/login - this is
    // why that route persists sb- cookies even on the needsMfa branch.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Session expired. Please sign in again." }, { status: 401 });
    }

    const rateLimit = await checkMfaRateLimit(user.id);
    if (rateLimit.blocked) {
      return NextResponse.json({ ok: false, error: rateLimit.reason }, { status: 429 });
    }

    // challengeAndVerify creates a challenge and verifies the TOTP code in
    // one call. On success the session is upgraded to AAL2, and this call
    // itself triggers another setAll() with the upgraded session cookies -
    // pendingCookies will hold those, not the AAL1 ones from getUser().
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (error) {
      console.error("[mfa-verify] Supabase error:", error.message);
      await recordMfaAttempt(user.id, false);
      const msg = error.message.toLowerCase().includes("invalid")
        ? "Incorrect code. Please try again."
        : error.message;
      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

    await recordMfaAttempt(user.id, true);

    let isAdmin = false;
    try {
      const { data: adminRow } = await supabaseAdmin
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = !!adminRow;
    } catch (e) {
      console.error("[mfa-verify] Admin lookup failed (non-fatal):", e.message);
    }

    const response = NextResponse.json({
      ok: true,
      isAdmin,
      user: { id: user.id, email: user.email },
    });

    console.log(`[mfa-verify] Success - ${user.id}, isAdmin: ${isAdmin}, aal: ${data?.currentLevel}`);
    return applyCookies(response, pendingCookies, rememberMe);

  } catch (err) {
    console.error("[mfa-verify] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected server error." }, { status: 500 });
  }
}