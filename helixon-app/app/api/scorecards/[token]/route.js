import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { logActivity } from "@/lib/candidates/activity";
import { RECOMMENDATIONS, cleanScorecard, formatInterviewTime } from "@/lib/interviews";

// Public: an interviewer's scorecard link (app/scorecard/[token]). The
// token is the only credential, so this answers with as little as the form
// needs - the candidate's name, the role, when the interview was and the
// criteria - and accepts one submission.

const TOKEN_RE = /^[a-f0-9]{48}$/;

async function load(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data } = await supabase
    .from("interview_feedback")
    .select("id, agency_id, reviewer_name, criteria, submitted_at, interviews(id, candidate_id, round, starts_at, duration_minutes, candidates(full_name, name), jobs(title, client)), agencies(name)")
    .eq("token", token)
    .maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`scorecard-get:${getClientIp(request)}`, 120))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  const i = row.interviews;
  return NextResponse.json({
    candidateName: i?.candidates?.full_name || i?.candidates?.name || "the candidate",
    jobTitle: i?.jobs?.title ?? null,
    client: i?.jobs?.client ?? null,
    when: i ? formatInterviewTime(i.starts_at, i.duration_minutes) : null,
    round: i?.round ?? 1,
    agencyName: row.agencies?.name ?? null,
    reviewerName: row.reviewer_name,
    criteria: (row.criteria ?? []).map((c) => c.name),
    submitted: Boolean(row.submitted_at),
    recommendations: RECOMMENDATIONS,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`scorecard-post:${getClientIp(request)}`, 20))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (row.submitted_at) return NextResponse.json({ error: "This scorecard has already been submitted." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const card = cleanScorecard(body, (row.criteria ?? []).map((c) => c.name));
  if (card.error) return NextResponse.json({ error: card.error }, { status: 400 });

  // Only the first submission lands, even if two arrive at once.
  const { data, error } = await supabase
    .from("interview_feedback")
    .update({ ...card, submitted_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("submitted_at", null)
    .select("id, reviewer_name");
  if (error) return NextResponse.json({ error: "Couldn't save your scorecard." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "This scorecard has already been submitted." }, { status: 409 });

  if (row.interviews?.candidate_id) {
    await logActivity(supabase, row.interviews.candidate_id, "scorecard_submitted", data[0].reviewer_name || "Interviewer", {
      note: `Round ${row.interviews.round}: ${card.overall_rating}/5 · ${RECOMMENDATIONS[card.recommendation]}`,
    });
  }
  return NextResponse.json({ ok: true });
}
