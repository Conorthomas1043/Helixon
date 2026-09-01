import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Same strength rule as signup - consider pulling this into a shared
// lib/validation.js so the two never drift apart.
function isStrongPassword(pw) {
  return (
    typeof pw === "string" &&
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[!@#$%^&*()\-_=+\[\]{};':",.<>?]/.test(pw)
  );
}

function applyCookies(response, cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const password = body?.password;

    if (!isStrongPassword(password)) {
      return NextResponse.json({ ok: false, error: "Password doesn't meet the strength requirements." }, { status: 400 });
    }

    const cookieStore = await cookies();
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
              try { cookieStore.set(name, value, options); } catch {}
            });
          },
        },
      }
    );

    // Requires the short-lived recovery session set by
    // /api/auth/reset-password/confirm. If it's missing or expired,
    // getUser() returns no user and we bail out with a clear message
    // rather than letting updateUser() fail more confusingly below.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Your reset link has expired. Please request a new one." },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    return applyCookies(response, pendingCookies);
  } catch (err) {
    console.error("[update-password] Error:", err.message);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}