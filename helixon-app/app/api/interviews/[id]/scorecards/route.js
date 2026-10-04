import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanUuid } from "@/lib/sanitize";
import { DEFAULT_CRITERIA, RECOMMENDATIONS, cleanReviewer, cleanScorecard, formatInterviewTime, toScorecard } from "@/lib/interviews";
import { loadInterview } from "@/lib/interview-access";
import { sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { agencyDb } from "@/lib/agency-db";

// Scorecards on an interview (lib/interviews.js).
//
// POST { mode: "submit", overallRating, recommendation, criteria, ... }
//     the recruiter fills one in themselves
// POST { mode: "request", reviewerName?, reviewerEmail?, send? }
//     a private link for an interviewer to fill one in without an account
//     (app/scorecard/[token]); emailed to them when send is true
// DELETE ?scorecardId=   remove one (e.g. a request sent to the wrong person)

function scorecardUrl(token) {
  return `${siteUrl()}/scorecard/${token}`;
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const interview = await loadInterview(auth.agencyId, id);
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const candidateName = interview.candidates?.full_name || interview.candidates?.name || "the candidate";

  if (body.mode === "submit") {
    const card = cleanScorecard(body, DEFAULT_CRITERIA);
    if (card.error) return NextResponse.json({ error: card.error }, { status: 400 });
    const { data, error } = await (await agencyDb())
      .from("interview_feedback")
      .insert({ ...card, reviewer_name: card.reviewer_name || actor, agency_id: auth.agencyId, interview_id: interview.id, submitted_at: new Date().toISOString(), created_by: auth.userId })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Failed to save the scorecard." }, { status: 500 });
    await logActivity(supabase, interview.candidate_id, "scorecard_submitted", actor, {
      note: `Round ${interview.round}: ${card.overall_rating}/5 · ${RECOMMENDATIONS[card.recommendation]} (${data.reviewer_name})`,
    });
    return NextResponse.json({ scorecard: toScorecard(data) }, { status: 201 });
  }

  if (body.mode === "request") {
    const reviewer = cleanReviewer(body);
    if (reviewer.error) return NextResponse.json({ error: reviewer.error }, { status: 400 });
    const token = crypto.randomBytes(24).toString("hex");
    const { data, error } = await (await agencyDb())
      .from("interview_feedback")
      .insert({ ...reviewer, agency_id: auth.agencyId, interview_id: interview.id, token, criteria: DEFAULT_CRITERIA.map((name) => ({ name, rating: null, comment: null })), created_by: auth.userId })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "Failed to create the scorecard link." }, { status: 500 });

    let emailed = false;
    let sendError = null;
    if (body.send && reviewer.reviewer_email) {
      const when = formatInterviewTime(interview.starts_at, interview.duration_minutes);
      const res = await sendAgencyEmail({
        agencyId: auth.agencyId,
        profile: auth.profile,
        to: reviewer.reviewer_email,
        subject: `Interview feedback: ${candidateName}${interview.jobs?.title ? ` - ${interview.jobs.title}` : ""}`,
        text: [
          `Hi${reviewer.reviewer_name ? ` ${reviewer.reviewer_name.split(" ")[0]}` : ""},`,
          "",
          `Thanks for interviewing ${candidateName} (${when}). Could you fill in a short scorecard? It takes a couple of minutes and no account is needed:`,
          "",
          scorecardUrl(token),
          "",
          "Thank you,",
          actor,
        ].join("\n"),
      });
      emailed = !res.error;
      sendError = res.error || null;
    }
    await logActivity(supabase, interview.candidate_id, "scorecard_requested", actor, {
      note: `Round ${interview.round}: from ${reviewer.reviewer_name || reviewer.reviewer_email}${emailed ? " (emailed)" : ""}`,
    });
    return NextResponse.json({ scorecard: toScorecard(data, { includeToken: true }), url: scorecardUrl(token), emailed, sendError }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const interview = await loadInterview(auth.agencyId, id);
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const scorecardId = cleanUuid(new URL(request.url).searchParams.get("scorecardId"));
  if (!scorecardId) return NextResponse.json({ error: "Which scorecard?" }, { status: 400 });
  const { error } = await (await agencyDb()).from("interview_feedback").delete().eq("id", scorecardId).eq("interview_id", interview.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to remove it." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
