// app/api/trial/start/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fail loudly at import time if env vars are missing, instead of a vague 500 later.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.error(
    "[trial/start] Missing Supabase env vars — NEXT_PUBLIC_SUPABASE_URL:",
    !!SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY:",
    !!SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Server is misconfigured (missing Supabase credentials)." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = (body?.email || "").trim().toLowerCase();
  const marketingOptIn = !!body?.marketingOptIn;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  let agencyId;

  const { data: existing, error: findErr } = await supabase
    .from("agencies")
    .select("id")
    .eq("intake_email", email)
    .maybeSingle();

  if (findErr) {
    // This is the line that tells you the REAL cause — check your server logs.
    console.error("[trial/start] Supabase find error:", findErr);
    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong. Please try again.",
        // Remove `debug` before going to production — it's here so you can see the cause now.
        debug: process.env.NODE_ENV !== "production" ? findErr.message : undefined,
      },
      { status: 500 }
    );
  }

  if (existing) {
    agencyId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("agencies")
      .insert({
        intake_email: email,
        name: email.split("@")[0], // placeholder until they name it properly
        settings: {
          marketing_opt_in: marketingOptIn,
          plan: "trial",
          analyses_used: 0,
        },
      })
      .select("id")
      .single();

    if (createErr) {
      console.error("[trial/start] Supabase insert error:", createErr);
      return NextResponse.json(
        {
          ok: false,
          error: "Something went wrong. Please try again.",
          debug: process.env.NODE_ENV !== "production" ? createErr.message : undefined,
        },
        { status: 500 }
      );
    }
    agencyId = created.id;
  }

  const res = NextResponse.json({ ok: true, redirectTo: "/analyse" });

  res.cookies.set("helixon_trial", agencyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}