import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const PW_RULES = {
  minLength:    (p) => p.length >= 8,
  hasUppercase: (p) => /[A-Z]/.test(p),
  hasNumber:    (p) => /[0-9]/.test(p),
  hasSymbol:    (p) => /[!@#$%^&*()\-_=+\[\]{};':",.<>?]/.test(p),
};

const PW_MESSAGES = {
  minLength:    "at least 8 characters",
  hasUppercase: "one uppercase letter",
  hasNumber:    "one number",
  hasSymbol:    "one special character (!@#$…)",
};

function validatePassword(password) {
  return Object.entries(PW_RULES)
    .filter(([, test]) => !test(password))
    .map(([key]) => key);
}

// Verifies a reCAPTCHA v3 token server-side. Never trust a client-only check —
// the secret key lives only here and is never shipped to the browser.
async function verifyRecaptcha(token, remoteIp) {
  if (!token) return { ok: false, reason: "Missing CAPTCHA token." };

  const params = new URLSearchParams({
    secret:   process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });
  if (remoteIp) params.append("remoteip", remoteIp);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

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
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { email, password, recaptchaToken } = body;

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }

    // 1. CAPTCHA — checked before we touch Supabase at all, so bots never
    //    even reach the password hasher / rate limit budget.
    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const captcha  = await verifyRecaptcha(recaptchaToken, remoteIp);
    if (!captcha.ok) {
      return NextResponse.json({ ok: false, error: captcha.reason }, { status: 400 });
    }

    // 2. Password shape validation (unchanged from before)
    const pwFailures = validatePassword(password);
    if (pwFailures.length > 0) {
      const readable = pwFailures.map((k) => PW_MESSAGES[k]).join(", ");
      return NextResponse.json(
        { ok: false, error: `Password must contain: ${readable}.` },
        { status: 400 }
      );
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

    // 3. Password auth. Note: this succeeds and issues an AAL1 session even
    //    for users enrolled in MFA — Supabase intentionally separates "who
    //    are you" from "are you fully verified" so we can gate on AAL below.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[login] Supabase error:", error.message);
      const msg = error.message.toLowerCase().includes("invalid login")
        ? "Incorrect email or password. Please try again."
        : error.message;
      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

    if (!data?.user) {
      return NextResponse.json({ ok: false, error: "Authentication failed. Please try again." }, { status: 500 });
    }

    // 4. MFA check — does this user have a verified TOTP factor enrolled?
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      console.error("[login] MFA factor lookup failed:", factorsError.message);
    }
    const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");

    if (totpFactor) {
      // Session exists at AAL1 only. Don't reveal admin status or finish
      // the response with a "logged in" shape — the client must complete
      // the MFA challenge via /api/auth/mfa-verify before we treat this
      // as a real session.
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

    // 5. No MFA enrolled — log in normally at AAL1.
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

    console.log(`[login] Success — ${data.user.id}, isAdmin: ${isAdmin}`);
    return response;

  } catch (err) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected server error." }, { status: 500 });
  }
}