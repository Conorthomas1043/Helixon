import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { GATE_COOKIE_NAME, GATE_MAX_AGE_SECONDS, signGateCookie } from "@/lib/auth/site-gate";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { fields, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const GateInput = fields({ password: str(400) });

// Server-side password check for the "under construction" gate. The
// password itself now lives only here (env var), never in shipped JS -
// so it can't be read out of the client bundle like the old version.
//
// Set in your environment (.env.local locally, your host's dashboard in
// prod). Never commit real values:
//   SITE_GATE_PASSWORD=whatever-you-want
//   SITE_GATE_SECRET=some-long-random-string

// FIX: was a second, separately-maintained "60 * 60 * 8" - now imported
// from lib/auth/site-gate.ts so the cookie's browser-side maxAge and the
// server-side expiry check in verifyGateCookie() can't drift apart.
const MAX_AGE = GATE_MAX_AGE_SECONDS;

export async function POST(request: NextRequest) {
  // The shared (Redis) limiter: an in-memory count reset on every cold
  // start and differed per instance.
  if (!(await rateLimit(`site-gate:${getClientIp(request)}`, 30))) {
    return NextResponse.json(
      { ok: false, error: "Whoa there. Give it a minute and try again." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(request, GateInput, {
    respond: (status: number, error: string) => NextResponse.json({ ok: false, error }, { status }),
  });
  if (parsed.response) return parsed.response;
  const body: { password?: string | null } = parsed.body;

  const submitted = typeof body?.password === "string" ? body.password : "";
  const correct = process.env.SITE_GATE_PASSWORD;

  if (!correct) {
    // Fail closed if misconfigured, never open.
    return NextResponse.json(
      { ok: false, error: "Gate isn't configured yet, nice try though." },
      { status: 500 }
    );
  }

  // Compared as fixed-length digests, in constant time, so neither the
  // length nor any prefix of the password shows in the response time.
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  const matches = crypto.timingSafeEqual(digest(submitted), digest(correct));

  if (!matches) {
    return NextResponse.json({ ok: false, error: "That's not it, try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE_NAME, await signGateCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}