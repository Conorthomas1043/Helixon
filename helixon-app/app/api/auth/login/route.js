import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

// FIX: this was reading/writing "login_attempts" — that table's schema is
// (id, ts, ip, username, login_type, success), built for the employee/admin
// login flow. It has no "email" or "created_at" columns, so every query and
// insert below was throwing, getting caught, and (because checkRateLimit
// fails open) silently disabling rate limiting entirely — nobody was ever
// actually blocked. "auth_login_attempts" (id, created_at, email, ip,
// success) is the table that was actually built to match this code —
// switching to it makes the queries below work as originally intended.
const RATE_LIMIT_TABLE = "auth_login_attempts";

async function checkRateLimit(email, ip) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const [{ count: emailFailures }, { count: ipFailures }] = await Promise.all([
      supabaseAdmin
        .from(RATE_LIMIT_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("success", false)
        .gte("created_at", since),
      ip
        ? supabaseAdmin
            .from(RATE_LIMIT_TABLE)
            .select("id", { count: "exact", head: true })
            .eq("ip", ip)
            .eq("success", false)
            .gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((emailFailures || 0) >= MAX_FAILURES_PER_EMAIL) {
      return { blocked: true, reason: "Too many failed attempts. Please try again in a few minutes." };
    }
    if ((ipFailures || 0) >= MAX_FAILURES_PER_IP) {
      return { blocked: true, reason: "Too many failed attempts from this network. Please try again shortly." };
    }
    return { blocked: false };
  } catch (e) {
    console.error("[login] Rate limit check failed (failing open):", e.message);
    return { blocked: false };
  }
}

async function recordAttempt(email, ip, success) {
  try {
    await supabaseAdmin.from(RATE_LIMIT_TABLE).insert({ email, ip, success });
  } catch (e) {
    console.error("[login] Failed to record login attempt:", e.message);
  }
}

// Applies the exact cookies Supabase's setAll gave us (name, value, AND its
// own options) onto the outgoing response. Never reconstruct these by hand -
// Supabase's options carry maxAge/expires/domain/sameSite that a hardcoded
// object will silently drop.
function applyCookies(response, cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

async function verifyRecaptcha(token, remoteIp) {
  if (!token) return { ok: false, reason: "Missing CAPTCHA token." };

  const params = new URLSearchParams({
    secret:   process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });
  if (remoteIp) params.append("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let res;
  try {
    res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch (e) {
    return { ok: false, reason: e.name === "AbortError" ? "CAPTCHA verification timed out." : "CAPTCHA verification failed." };
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, reason: "CAPTCHA verification failed." };

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  if (!data.success) return { ok: false, reason: "CAPTCHA validation failed." };
  if (data.action !== "login") return { ok: false, reason: "CAPTCHA action mismatch." };
  if (typeof data.score === "number" && data.score < minScore) {
    return { ok: false, reason: "Suspicious activity detected. Please try again." };
  }
  return { ok: true };
}

export async function POST(request) {
  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  let email = null;

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { password, recaptchaToken } = body;
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const captcha = await verifyRecaptcha(recaptchaToken, remoteIp);
    if (!captcha.ok) {
      return NextResponse.json({ ok: false, error: captcha.reason }, { status: 400 });
    }

    const rateLimit = await checkRateLimit(email, remoteIp);
    if (rateLimit.blocked) {
      return NextResponse.json({ ok: false, error: rateLimit.reason }, { status: 429 });
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[login] Supabase error:", error.message);
      await recordAttempt(email, remoteIp, false);
      const msg = error.message.toLowerCase().includes("invalid login")
        ? "Incorrect email or password. Please try again."
        : error.message;
      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

    if (!data?.user) {
      await recordAttempt(email, remoteIp, false);
      return NextResponse.json({ ok: false, error: "Authentication failed. Please try again." }, { status: 500 });
    }

    // 3b. Email verification gate. If "Confirm email" is enabled in the
    //     Supabase Auth settings, signInWithPassword() above already
    //     refuses unconfirmed users with an "Email not confirmed" error,
    //     so this is normally unreachable - but we check explicitly too
    //     as defense-in-depth (e.g. if that project setting is ever
    //     toggled off, or a user was created via admin API bypassing it).
    //     We do NOT set any session cookies in this branch.
    if (!data.user.email_confirmed_at) {
      await recordAttempt(email, remoteIp, false);
      return NextResponse.json(
        {
          ok: false,
          error: "Please verify your email before logging in. Check your inbox for the confirmation link.",
          code: "EMAIL_NOT_CONFIRMED",
        },
        { status: 403 }
      );
    }

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      console.error("[login] MFA factor lookup failed:", factorsError.message);
      await recordAttempt(email, remoteIp, false);
      return NextResponse.json(
        { ok: false, error: "Couldn't verify your account's security settings. Please try again." },
        { status: 500 }
      );
    }

    const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");

    if (totpFactor) {
      await recordAttempt(email, remoteIp, true);
      const response = NextResponse.json({
        ok: true,
        needsMfa: true,
        factorId: totpFactor.id,
      });
      return applyCookies(response, pendingCookies);
    }

    let isAdmin = false;
    try {
      const { data: adminRow } = await supabaseAdmin
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      isAdmin = !!adminRow;
    } catch (e) {
      console.error("[login] Admin lookup failed (non-fatal):", e.message);
    }

    await recordAttempt(email, remoteIp, true);

    const response = NextResponse.json({
      ok: true,
      needsMfa: false,
      isAdmin,
      user: { id: data.user.id, email: data.user.email },
    });

    console.log(`[login] Success - ${data.user.id}, isAdmin: ${isAdmin}`);
    return applyCookies(response, pendingCookies);

  } catch (err) {
    console.error("[login] Unexpected error:", err);
    if (email) await recordAttempt(email, remoteIp, false);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected server error." }, { status: 500 });
  }
}