// app/api/employee/login/route.js
import { loginEmployee } from "@/lib/employee-auth";
import { supabase } from "@/lib/supabase";

// Simple in-memory rate limiter (resets on cold start; good enough for Vercel)
// For production volume, swap to Vercel KV or Upstash Redis.
const attempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not rate-limited
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(request) {
  const ip =
    request.headers.get("x-client-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (checkRateLimit(ip)) {
    // Log the lockout as a security event
    await supabase.from("security_events").insert({
      event_type: "rate_limit_hit",
      severity: "medium",
      ip,
      detail: { path: "/api/employee/login" },
    }).catch(() => {});

    return Response.json(
      { ok: false, error: "Too many login attempts. Wait 15 minutes." },
      { status: 429 }
    );
  }

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return Response.json({ ok: false, error: "Username and password required." }, { status: 400 });
    }

    const result = await loginEmployee({ username, password });

    // Log attempt (success or fail) for the Security tab
    await supabase.from("login_attempts").insert({
      ip,
      username,
      login_type: "employee",
      success: result.ok,
    }).catch(() => {});

    if (!result.ok) {
      // Check if this IP is hammering failed logins and auto-flag it
      const h1 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gte("ts", h1);

      if ((count || 0) >= 5) {
        await supabase.from("security_events").insert({
          event_type: "brute_force_detected",
          severity: "high",
          ip,
          detail: { failed_attempts_1h: count, login_type: "employee", last_username: username },
        }).catch(() => {});
      }

      return Response.json({ ok: false, error: result.error }, { status: 401 });
    }

    return Response.json({ ok: true, employee: result.employee });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}