import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";

// Returns the currently signed-in user (email + first name from `profiles`,
// plus isAdmin), or 401 if there's no valid session. Used by the dashboard
// to personalize the header/account menu and to drive the one-time
// "Welcome back" banner after login.
export async function GET() {
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
            try { cookieStore.set(name, value, options); } catch { /* see applyCookies below */ }
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let firstName = null;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    firstName = profile?.first_name || null;
  } catch (e) {
    console.error("[auth/me] Profile lookup failed (non-fatal):", e.message);
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
    console.error("[auth/me] Admin lookup failed (non-fatal):", e.message);
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, firstName, isAdmin },
  });

  // getUser() can silently refresh an expiring access token, in which case
  // Supabase calls setAll() with new cookies that need to land on the
  // response too, not just the request-scoped cookieStore.
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
