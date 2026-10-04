// app/api/candidates/[id]/feedback-requests/route.js
// Recruiter-side: generate a feedback-request link for a candidate (their
// own NPS-style survey) or for a hiring-manager/client contact (candidate
// fit/quality rating), and list the ones already sent for this candidate.
// The link itself is answered on an unauthenticated public page
// (app/feedback/[token]) since neither a candidate nor a client contact
// has a Helixon account - see app/api/feedback-requests/[token]/route.js.
//
// POST { kind, recipientLabel?, sendTo? }  create a link; with sendTo, also
//                                          email it to that address
// POST { requestId, sendTo }               email an existing, unanswered link

import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { cleanEmail, cleanLine, cleanUuid } from "@/lib/sanitize";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { agencyDisplayName } from "@/lib/agency-display";
import { feedbackRequestEmail } from "@/lib/feedback-request-email";
import { candidateHidden } from "@/lib/permissions";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";

const MAX_EMAILS_PER_HOUR = 40;

const KIND_VALUES = new Set(["candidate_nps", "client_feedback"]);

function requestUrl(token) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  return `${origin}/feedback/${token}`;
}

function shape(row) {
  return {
    id: row.id,
    kind: row.kind,
    recipientLabel: row.recipient_label,
    rating: row.rating,
    comment: row.comment,
    tags: row.tags,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    url: row.responded_at ? null : requestUrl(row.token),
  };
}

export const GET = customerRoute(async (request, { params }, auth) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId } = auth;
  const { id } = await params;

  const { data, error } = await (await agencyDb())
    .from("feedback_requests")
    .select("id, kind, recipient_label, rating, comment, tags, token, created_at, responded_at")
    .eq("candidate_id", id)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    reportError("[feedback-requests] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to load feedback requests." }, { status: 500 });
  }

  return NextResponse.json({ requests: (data || []).map(shape) });
});

// Emails the link for `row` (a feedback_requests row) to `to`, from the
// agency's name with replies going to the recruiter. Returns an error
// message, or null when it was handed to Resend.
async function emailRequest({ auth, candidate, row, to }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return "Email isn't set up yet - copy the link instead.";
  if (!(await rateLimit(`feedback-email:${auth.userId}`, MAX_EMAILS_PER_HOUR))) return "You've sent a lot of these in the last hour - try again later.";

  const [{ data: agency }, sender] = await Promise.all([
    supabase.from("agencies").select("name").eq("id", auth.agencyId).maybeSingle(),
    currentUser().catch(() => null),
  ]);
  const agencyName = agencyDisplayName(agency, auth.profile);
  const email = feedbackRequestEmail({
    kind: row.kind,
    url: requestUrl(row.token),
    agencyName,
    recruiterName: recruiterDisplayName(auth.profile),
    candidateName: candidate.full_name || candidate.name || "the candidate",
    jobTitle: candidate.jobs?.title || null,
  });
  const fromName = agencyName.replace(/["<>,;:\\\r\n]/g, "").trim().slice(0, 80) || "Helixon";
  const replyTo = sender?.primaryEmailAddress?.emailAddress;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${fromName} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject: email.subject,
    text: email.text,
  });
  if (error) {
    reportError("[feedback-requests] Send failed:", error.message);
    return "The email couldn't be sent - copy the link instead.";
  }
  await logActivity(supabase, candidate.id, "feedback_request_sent", recruiterDisplayName(auth.profile) || auth.userId, {
    note: `${row.kind === "candidate_nps" ? "Candidate" : "Client"} feedback request to ${to}`,
  });
  return null;
}

export const POST = customerRoute(async (request, { params }, auth, body) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId } = auth;
  const { id } = await params;

  const sendTo = body?.sendTo ? cleanEmail(body.sendTo) : null;
  if (body?.sendTo && !sendTo) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const { data: candidate, error: candidateError } = await (await agencyDb())
    .from("candidates")
    .select("id, job_id, full_name, name, jobs(title)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (candidateError || !candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Email a link that already exists.
  if (body?.requestId) {
    const requestId = cleanUuid(body.requestId);
    if (!requestId || !sendTo) return NextResponse.json({ error: "Which request, and who to?" }, { status: 400 });
    const { data: row } = await (await agencyDb())
      .from("feedback_requests")
      .select("id, kind, recipient_label, rating, comment, tags, token, created_at, responded_at")
      .eq("id", requestId)
      .eq("candidate_id", id)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.responded_at) return NextResponse.json({ error: "They've already answered this one." }, { status: 409 });
    const sendError = await emailRequest({ auth, candidate, row, to: sendTo });
    if (sendError) return NextResponse.json({ error: sendError }, { status: 502 });
    return NextResponse.json({ request: shape(row), emailedTo: sendTo });
  }

  const kind = body?.kind;
  if (!KIND_VALUES.has(kind)) {
    return NextResponse.json({ error: "Invalid feedback request kind." }, { status: 400 });
  }
  const recipientLabel = cleanLine(body?.recipientLabel, 120) || sendTo || null;

  const token = crypto.randomBytes(24).toString("hex");

  const { data, error } = await (await agencyDb())
    .from("feedback_requests")
    .insert({
      agency_id: agencyId,
      candidate_id: id,
      job_id: candidate.job_id,
      kind,
      token,
      recipient_label: recipientLabel,
      created_by: userId,
    })
    .select("id, kind, recipient_label, rating, comment, tags, token, created_at, responded_at")
    .single();

  if (error) {
    reportError("[feedback-requests] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to create feedback request." }, { status: 500 });
  }

  // The link exists either way; a failed send says so and leaves it to copy.
  const sendError = sendTo ? await emailRequest({ auth, candidate, row: data, to: sendTo }) : null;
  return NextResponse.json({ request: shape(data), emailedTo: sendTo && !sendError ? sendTo : null, sendError });
}, { body: JsonObject, optionalBody: true });
