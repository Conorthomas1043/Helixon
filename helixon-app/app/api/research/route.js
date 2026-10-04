import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";
import { cleanText } from "@/lib/sanitize";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { recordSignal } from "@/lib/research-signals";
import { captureAgencyEvent } from "@/lib/server-analytics";
import { umuxLiteScore } from "@/lib/umux-lite";

// The signed-in recruiter's side of research (docs/ux-research-audit.md, R8):
//   GET   { pulseDue, optedIn }      whether to show the pulse survey
//   POST  { kind: "pulse_survey", capabilities, ease, comment? }
//   POST  { kind: "research_optin", optIn: boolean }
//
// The pulse survey asks at most once every 90 days - a spacing chosen to
// avoid survey fatigue, which lowers both response rates and answer quality
// when people are surveyed repeatedly (Porter, Whitcomb & Weitzer, 2004,
// New Directions for Institutional Research 121).
const PULSE_EVERY_DAYS = 90;

function missingTable(error) {
  return error && (error.code === "42P01" || error.code === "PGRST205");
}

export async function GET() {
  const { user, profile } = await getCustomerContext();
  if (!user?.id || !profile?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const since = new Date(Date.now() - PULSE_EVERY_DAYS * 86400000).toISOString();
  const [{ data: recent, error }, { data: optins }] = await Promise.all([
    supabase.from("research_signals").select("id").eq("profile_id", profile.id).eq("kind", "pulse_survey").gte("created_at", since).limit(1),
    supabase.from("research_signals").select("label, created_at").eq("profile_id", profile.id).eq("kind", "research_optin").order("created_at", { ascending: false }).limit(1),
  ]);
  if (missingTable(error)) return NextResponse.json({ ok: true, pulseDue: false, optedIn: false, available: false });
  return NextResponse.json({
    ok: true,
    available: true,
    pulseDue: !error && !(recent || []).length,
    optedIn: Boolean(optins?.[0] && optins[0].label !== "withdrawn"),
  });
}

export async function POST(request) {
  const { user, profile } = await getCustomerContext();
  if (!user?.id || !profile?.id) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit(`research:${getClientIp(request)}`, 20))) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const agencyId = profile.agency_id || null;

  if (body?.kind === "pulse_survey") {
    const capabilities = Number(body.capabilities);
    const ease = Number(body.ease);
    const score = umuxLiteScore(capabilities, ease);
    if (score == null) return NextResponse.json({ ok: false, error: "Answer both questions." }, { status: 400 });
    const comment = cleanText(body.comment, { max: 2000 }) || null;
    await recordSignal({ kind: "pulse_survey", agencyId, profileId: profile.id, label: "umux_lite", body: comment, meta: { capabilities, ease, umuxLite: score } });
    await captureAgencyEvent("pulse_survey_submitted", agencyId, { umux_lite: score, with_comment: Boolean(comment) });
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === "research_optin") {
    await recordSignal({ kind: "research_optin", agencyId, profileId: profile.id, label: body.optIn === false ? "withdrawn" : "settings" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown request." }, { status: 400 });
}
