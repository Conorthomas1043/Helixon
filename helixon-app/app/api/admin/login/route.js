import { NextResponse } from "next/server";
import { checkAdminCredentials, createAdminSession } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { verifyAdminTotp, adminHasTotp } from "@/lib/admin-totp";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { cleanLine } from "@/lib/sanitize";

// Attempts allowed per hour. The per-IP cap stops one client hammering
// passwords; the per-username cap stops a distributed guess at one admin
// account, set higher so someone spamming a username can't easily lock the
// real admin out.
const MAX_ATTEMPTS_PER_IP = 10;

// One message for every way a sign-in can fail (unknown user, wrong password,
// wrong or missing code), so the reply never says which part was right.
const LOGIN_FAILED_MESSAGE = "Incorrect username, password or code.";
const MAX_ATTEMPTS_PER_USERNAME = 30;

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Every sign-in outcome goes in the admin audit log. Best-effort: a logging
// failure must never block a legitimate login or turn a failed one into a 500.
async function audit(action, username, request, metadata = {}) {
  try {
    await writeAdminAudit({
      adminUsername: cleanLine(username, 64) || "unknown",
      action,
      targetType: "admin_session",
      metadata,
      request,
    });
  } catch (err) {
    console.error("[admin/login] Could not write audit log:", err.message);
  }
}

export async function POST(request) {
  try {
    if (!(await rateLimit(`admin-login:ip:${getClientIp(request)}`, MAX_ATTEMPTS_PER_IP))) {
      await audit("admin_login_rate_limited", "unknown", request);
      return json({ error: "Too many login attempts. Please try again later." }, 429);
    }

    const body = await request.json().catch(() => null);

    const username = cleanLine(body?.username, 64);
    const password = typeof body?.password === "string" ? body.password.slice(0, 1024) : "";

    if (!username || !password) {
      return json({ error: "Username and password are required." }, 400);
    }

    if (!(await rateLimit(`admin-login:user:${username.toLowerCase()}`, MAX_ATTEMPTS_PER_USERNAME))) {
      await audit("admin_login_rate_limited", username, request);
      return json({ error: "Too many login attempts. Please try again later." }, 429);
    }

    // Always the same message for a wrong username or wrong password (and the
    // same amount of work either way) - see lib/admin-auth.js.
    const result = await checkAdminCredentials(username, password);

    if (!result.ok) {
      await audit("admin_login_failed", username, request, { stage: "password" });
      return json({ error: LOGIN_FAILED_MESSAGE }, 401);
    }

    // Second factor, for admins who have one (or everyone, if ADMIN_REQUIRE_2FA
    // is on). A missing or wrong code gets the very same response as a wrong
    // password, so the reply never reveals that the password was right; the
    // real reason is only in the audit log.
    const totp = await verifyAdminTotp(username, body?.code);
    if (!totp.ok) {
      await audit("admin_login_failed", username, request, { stage: "second_factor", reason: totp.reason });
      return json({ error: LOGIN_FAILED_MESSAGE }, 401);
    }

    await createAdminSession(username);
    await audit("admin_login", username, request, { twoFactor: adminHasTotp(username) });

    return json({ ok: true, username });
  } catch (error) {
    console.error("[admin/login] Error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
