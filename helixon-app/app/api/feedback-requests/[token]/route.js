// app/api/feedback-requests/[token]/route.js
// The public (unauthenticated) side of the feedback-request system -
// answered by a candidate or a hiring-manager/client contact, neither of
// whom has a Helixon account. The opaque token stands in for a login,
// same pattern as the employee calendar's ICS feed token. Not listed in
// proxy.ts's gated prefixes, so it's reachable without a session.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { cleanText } from "@/lib/sanitize";
import { reportError } from "@/lib/report-error";
import { fields, ids, num, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const FeedbackAnswerInput = fields({ rating: num, comment: text(4000), tags: ids(20) });

const MAX_SUBMISSIONS_PER_HOUR = 20; // per IP - this is a low-traffic public form, not an API
const TAG_VALUES = new Set([
  // candidate_nps tags
  "clear_process",
  "unclear_process",
  "great_communication",
  "slow_communication",
  "fair_interview",
  "unfair_interview",
  // client_feedback tags
  "strong_quality",
  "weak_quality",
  "fast_submission",
  "slow_submission",
  "good_partnership",
]);

// Links are made with 48 hex characters; the looser shape keeps any older
// link working while refusing junk before it reaches the database.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

async function loadRequest(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data, error } = await supabase
    .from("feedback_requests")
    .select(
      "id, agency_id, kind, rating, responded_at, candidates(full_name, name), jobs(title, client), agencies(name, suspended_at)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  // A suspended workspace's links stop working with the rest of it.
  return data.agencies?.suspended_at ? null : data;
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`feedback-request-get:${getClientIp(request)}`, 120))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const row = await loadRequest(token);
  if (!row) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  return NextResponse.json({
    kind: row.kind,
    responded: !!row.responded_at,
    candidateName: row.candidates?.full_name || row.candidates?.name || "the candidate",
    jobTitle: row.jobs?.title || null,
    company: row.jobs?.client || null,
    agencyName: row.agencies?.name || "the agency",
  });
}

export async function POST(request, { params }) {
  const { token } = await params;

  const ip = getClientIp(request);
  if (!(await rateLimit(`feedback-request:${ip}`, MAX_SUBMISSIONS_PER_HOUR))) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const row = await loadRequest(token);
  if (!row) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  if (row.responded_at) {
    return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  }

  const parsedBody = await parseBody(request, FeedbackAnswerInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  const maxRating = row.kind === "candidate_nps" ? 10 : 5;
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 0 || rating > maxRating) {
    return NextResponse.json({ error: `Rating must be a whole number from 0 to ${maxRating}.` }, { status: 400 });
  }

  const comment = cleanText(body?.comment, { max: 2000 }) || null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t) => TAG_VALUES.has(t)).slice(0, 6) : [];

  const { error } = await supabase
    .from("feedback_requests")
    .update({ rating, comment, tags, responded_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("responded_at", null); // guards a race between two near-simultaneous submits on the same link

  if (error) {
    reportError("[feedback-requests] Response save failed:", error.message);
    return NextResponse.json({ error: "Could not save your response. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
