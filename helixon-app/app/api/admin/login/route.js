import { NextResponse } from "next/server";
import { checkAdminCredentials, createAdminSession } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

// Attempts allowed per hour. The per-IP cap stops one client hammering
// passwords; the per-username cap stops a distributed guess at one admin
// account, set higher so someone spamming a username can't easily lock the
// real admin out.
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_USERNAME = 30;

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  try {
    if (!(await rateLimit(`admin-login:ip:${getClientIp(request)}`, MAX_ATTEMPTS_PER_IP))) {
      return json({ error: "Too many login attempts. Please try again later." }, 429);
    }

    const body = await request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return json({ error: "Username and password are required." }, 400);
    }

    if (!(await rateLimit(`admin-login:user:${username.toLowerCase().slice(0, 64)}`, MAX_ATTEMPTS_PER_USERNAME))) {
      return json({ error: "Too many login attempts. Please try again later." }, 429);
    }

    // Always the same message for a wrong username or wrong password (and the
    // same amount of work either way) - see lib/admin-auth.js.
    const result = await checkAdminCredentials(username, password);

    if (!result.ok) {
      return json({ error: result.error }, 401);
    }

    await createAdminSession(username);

    return json({ ok: true, username });
  } catch (error) {
    console.error("[admin/login] Error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
