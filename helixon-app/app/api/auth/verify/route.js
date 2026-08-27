import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Applies the exact cookies Supabase's setAll gave us (name, value, AND its
// own options) onto the outgoing response. Never reconstruct these by hand.
function applyCookies(response, cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

// Called by the /verify-email client page. Mirrors what /api/auth/verify
// (the GET redirect handler) does, but returns JSON instead of redirecting,
// since this route is hit via fetch() from a client component rather than
// by the browser navigating directly to the email link.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token_hash = body?.token_hash;
    const type = body?.type;

    if (!token_hash || !type) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
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

    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
      console.error("[verify-email] verifyOtp failed:", error.message);
      const reason = error.message?.toLowerCase().includes("expired") ? "expired" : "error";
      return NextResponse.json({ ok: false, error: reason }, { status: 400 });
    }

    console.log(`[verify-email] Success - ${data?.user?.id}`);

    const response = NextResponse.json({
      ok: true,
      user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    });
    return applyCookies(response, pendingCookies);

  } catch (err) {
    console.error("[verify-email] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}