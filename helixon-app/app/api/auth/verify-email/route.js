import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// This route didn't exist at all - /verify-email (signup confirmation) and
// /update-password (password recovery) both POST here expecting it to
// exchange the token_hash from an email link for a session via
// supabase.auth.verifyOtp(), but there was nothing listening at this path.
// Every signup confirmation and every password-reset link 404'd here,
// which meant no one could ever confirm their email (login blocks
// unconfirmed accounts - see the email_confirmed_at check in
// /api/auth/login) or complete a password reset.

const VALID_TYPES = ["signup", "recovery", "magiclink", "email_change", "invite"];

// Applies the exact cookies Supabase's setAll gave us (name, value, AND its
// own options) onto the outgoing response - same pattern as /api/auth/login
// and /api/auth/mfa-verify.
function applyCookies(response, cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token_hash = typeof body?.token_hash === "string" ? body.token_hash : "";
    const type = typeof body?.type === "string" ? body.type : "signup";

    if (!token_hash) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }

    const cookieStore = await cookies();
    let pendingCookies = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
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

    // verifyOtp() both confirms the token AND, on success, sets a real
    // session (triggering setAll() above) - that session is what
    // /api/auth/update-password relies on for "recovery" type, and what
    // lets /verify-email drop the person straight into a logged-in state
    // for "signup"/"magiclink" type.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
      console.error("[verify-email] verifyOtp:", error.message);
      // Supabase uses overlapping wording for "expired" and "already used"
      // tokens. Either way the frontend's "expired" state (offer a resend/
      // new link) is the right response - there's no path where telling
      // the person to retry the exact same link helps.
      return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    });
    return applyCookies(response, pendingCookies);
  } catch (err) {
    console.error("[verify-email] Unexpected error:", err.message);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
