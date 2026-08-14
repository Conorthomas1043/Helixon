import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE_NAME, signGateCookie, tooManyGateAttempts } from "@/lib/site-gate";

// Server-side password check for the "under construction" gate. The
// password itself now lives only here (env var), never in shipped JS —
// so it can't be read out of the client bundle like the old version.
//
// Set in your environment (.env.local locally, your host's dashboard in
// prod). Never commit real values:
//   SITE_GATE_PASSWORD=whatever-you-want
//   SITE_GATE_SECRET=some-long-random-string

const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (tooManyGateAttempts(ip)) {
    return NextResponse.json(
      { ok: false, error: "Whoa there. Give it a minute and try again." },
      { status: 429 }
    );
  }

  let body: { password?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const submitted = typeof body?.password === "string" ? body.password : "";
  const correct = process.env.SITE_GATE_PASSWORD;

  if (!correct) {
    // Fail closed if misconfigured, never open.
    return NextResponse.json(
      { ok: false, error: "Gate isn't configured yet — nice try though." },
      { status: 500 }
    );
  }

  const matches = submitted.length === correct.length && submitted === correct;
  // (Length-then-compare is a minor timing-safety nicety; this endpoint
  // is already rate-limited above, which matters more in practice.)

  if (!matches) {
    return NextResponse.json({ ok: false, error: "That's not it — try again." }, { status: 401 });
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