import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Rate limiting ────────────────────────────────────────────────────────
// Simple sliding-window check against the login_attempts table (service
// role). Blocks on too many recent failures for either the email or the
// IP, whichever trips first - catches both "one account being brute
// forced" and "one IP spraying many accounts".
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

async function checkRateLimit(email, ip) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const [{ count: emailFailures }, { count: ipFailures }] = await Promise.all([
      supabaseAdmin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("success", false)
        .gte("created_at", since),
      ip
        ? supabaseAdmin
            .from("login_attempts")
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
    // Fail open on the rate-limit check itself (a DB hiccup here shouldn't
    // lock out every legitimate login) - but this is logged so an outage
    // in login_attempts doesn't silently disable rate limiting for long.
    console.error("[login] Rate limit check failed (failing open):", e.message);
    return { blocked: false };
  }
}

async function recordAttempt(email, ip, success) {
  try {
    await supabaseAdmin.from("login_attempts").insert({ email, ip, success });
  } catch (e) {
    console.error("[login] Failed to record login attempt:", e.message);
  }
}

// Verifies a reCAPTCHA v3 token server-side. Never trust a client-only check -
// the secret key lives only here and is never shipped to the browser.
async function verifyRecaptcha(token, remoteIp) {
  if (!token) return { ok: false, reason: "Missing CAPTCHA token." };

  const params = new URLSearchParams({
    secret:   process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });
  if (remoteIp) params.append("remoteip", remoteIp);

  // Guard against a hung upstream - without this, a slow/unresponsive
  // reCAPTCHA endpoint stalls every login indefinitely.
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

  // v3 returns a 0.0–1.0 bot-likelihood score instead of a pass/fail checkbox.
  // 0.5 is Google's own suggested default threshold; tighten if you see abuse.
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

    // 1. CAPTCHA - checked before we touch Supabase at all, so bots never
    //    even reach the password check / rate limit budget.
    const captcha = await verifyRecaptcha(recaptchaToken, remoteIp);
    if (!captcha.ok) {
      return NextResponse.json({ ok: false, error: captcha.reason }, { status: 400 });
    }

    // 2. Rate limit - checked before Supabase auth so a brute-force run
    //    against one account (or a spray across many from one IP) gets
    //    stopped without burning further Supabase auth calls.
    const rateLimit = await checkRateLimit(email, remoteIp);
    if (rateLimit.blocked) {
      // Not recorded as an attempt - the account/IP is already over the
      // threshold, no need to keep counting past it.
      return NextResponse.json({ ok: false, error: rateLimit.reason }, { status: 429 });
    }

    // NOTE: password strength rules intentionally are NOT enforced here.
    // That belongs at signup time - checking "strength" on login only
    // punishes real users whose password predates a rules change, or
    // if the rules are ever tightened later. Login should just pass
    // whatever was typed straight to Supabase and let it be the judge
    // of correctness.

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

    // 3. Password auth. Note: this succeeds and issues an AAL1 session even
    //    for users enrolled in MFA - Supabase intentionally separates "who
    //    are you" from "are you fully verified" so we can gate on AAL below.
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

    // 4. MFA check - does this user have a verified TOTP factor enrolled?
    //
    //    Fail CLOSED here: if the factor lookup itself errors, we must
    //    NOT fall through and treat the user as "no MFA enrolled" - that
    //    would let an MFA-enrolled user bypass their second factor
    //    entirely just because listFactors() had a bad moment. Instead,
    //    treat a failed lookup as if MFA is required but unconfirmed,
    //    and ask the user to retry rather than silently granting a full
    //    AAL1-only session.
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
      // Session exists at AAL1 only. Don't reveal admin status or finish
      // the response with a "logged in" shape - the client must complete
      // the MFA challenge via /api/auth/mfa-verify before we treat this
      // as a real session.
      await recordAttempt(email, remoteIp, true);
      const response = NextResponse.json({
        ok: true,
        needsMfa: true,
        factorId: totpFactor.id,
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
      return response;
    }

    // 5. No MFA enrolled - log in normally at AAL1.
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

    console.log(`[login] Success - ${data.user.id}, isAdmin: ${isAdmin}`);
    return response;

  } catch (err) {
    console.error("[login] Unexpected error:", err);
    if (email) await recordAttempt(email, remoteIp, false);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected server error." }, { status: 500 });
  }
}