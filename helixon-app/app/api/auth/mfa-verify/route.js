import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { factorId, code } = body;
    if (!factorId || !code) {
      return NextResponse.json({ ok: false, error: "Verification code is required." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase    = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
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

    // challengeAndVerify creates a challenge and verifies the TOTP code in
    // one call. On success the session is upgraded to AAL2.
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (error) {
      console.error("[mfa-verify] Supabase error:", error.message);
      const msg = error.message.toLowerCase().includes("invalid")
        ? "Incorrect code. Please try again."
        : error.message;
      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

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

    cookieStore.getAll().forEach(({ name, value }) => {
      if (name.startsWith("sb-")) {
        response.cookies.set(name, value, {
          httpOnly: true,
          secure:   process.env.NODE_ENV === "production",
          sameSite: "lax",
          path:     "/",
        });
      }
    });

    console.log(`[mfa-verify] Success - ${user.id}, isAdmin: ${isAdmin}, aal: ${data?.currentLevel}`);
    return response;

  } catch (err) {
    console.error("[mfa-verify] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected server error." }, { status: 500 });
  }
}