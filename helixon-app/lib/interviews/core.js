// Interviews and scorecards - see
// supabase/migrations/20261001010000_interviews_and_scorecards.sql.

import { cleanEmail, cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";

export const INTERVIEW_KINDS = { video: "Video call", phone: "Phone", in_person: "In person" };
export const INTERVIEW_STATUSES = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
export const INTERVIEW_OUTCOMES = { progress: "Progress", hold: "On hold", reject: "Reject" };
export const RECOMMENDATIONS = { strong_yes: "Strong yes", yes: "Yes", no: "No", strong_no: "Strong no" };

// What every scorecard rates, unless the recruiter changes it.
export const DEFAULT_CRITERIA = ["Role skills", "Relevant experience", "Communication", "Motivation and fit"];

// The interview fields from a request body, as columns. With `creating`,
// a start time is required. { error } on invalid input.
export function cleanInterviewFields(body = {}, { creating = false } = {}) {
  const out = {};
  if (body.startsAt !== undefined || creating) {
    const d = typeof body.startsAt === "string" ? new Date(body.startsAt) : null;
    if (!d || Number.isNaN(d.getTime())) return { error: "Pick a date and time." };
    out.starts_at = d.toISOString();
  }
  if (body.durationMinutes !== undefined) {
    const n = Number(body.durationMinutes);
    if (!Number.isInteger(n) || n < 5 || n > 600) return { error: "Duration must be 5–600 minutes." };
    out.duration_minutes = n;
  }
  if (body.kind !== undefined) {
    if (!INTERVIEW_KINDS[body.kind]) return { error: "Unknown interview type." };
    out.kind = body.kind;
  }
  if (body.round !== undefined) {
    const n = Number(body.round);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { error: "Round must be 1–20." };
    out.round = n;
  }
  if (body.location !== undefined) out.location = cleanLine(body.location, 500) || null;
  if (body.interviewers !== undefined) out.interviewers = cleanLine(body.interviewers, 500) || null;
  if (body.notes !== undefined) out.notes = cleanText(body.notes, { max: 2000 }) || null;
  if (body.status !== undefined) {
    if (!INTERVIEW_STATUSES[body.status]) return { error: "Unknown status." };
    out.status = body.status;
  }
  if (body.outcome !== undefined) {
    if (body.outcome !== null && !INTERVIEW_OUTCOMES[body.outcome]) return { error: "Unknown outcome." };
    out.outcome = body.outcome;
  }
  if (body.contactId !== undefined) out.contact_id = body.contactId ? cleanUuid(body.contactId) : null;
  return out;
}

// A submitted scorecard from a request body. Criteria are matched to the
// names on the scorecard; ratings are 1-5. { error } on invalid input.
export function cleanScorecard(body = {}, criteriaNames = DEFAULT_CRITERIA) {
  const overall = Number(body.overallRating);
  if (!Number.isInteger(overall) || overall < 1 || overall > 5) return { error: "Give an overall rating from 1 to 5." };
  if (!RECOMMENDATIONS[body.recommendation]) return { error: "Choose a recommendation." };
  const given = Array.isArray(body.criteria) ? body.criteria : [];
  const criteria = criteriaNames.map((name) => {
    const match = given.find((c) => c && c.name === name);
    const rating = Number(match?.rating);
    return {
      name,
      rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
      comment: cleanLine(match?.comment, 500) || null,
    };
  });
  return {
    overall_rating: overall,
    recommendation: body.recommendation,
    criteria,
    strengths: cleanText(body.strengths, { max: 3000 }) || null,
    concerns: cleanText(body.concerns, { max: 3000 }) || null,
    comments: cleanText(body.comments, { max: 3000 }) || null,
    ...(body.reviewerName !== undefined ? { reviewer_name: cleanLine(body.reviewerName, 200) || null } : {}),
  };
}

export function cleanReviewer(body = {}) {
  const name = cleanLine(body.reviewerName, 200);
  const email = body.reviewerEmail ? cleanEmail(body.reviewerEmail) : null;
  if (body.reviewerEmail && !email) return { error: "That email address doesn't look right." };
  if (!name && !email) return { error: "Who should fill it in?" };
  return { reviewer_name: name || null, reviewer_email: email };
}

export function toInterview(row) {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    contactId: row.contact_id,
    round: row.round,
    kind: row.kind,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    location: row.location,
    interviewers: row.interviewers,
    notes: row.notes,
    status: row.status,
    outcome: row.outcome,
    invitedAt: row.invited_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toScorecard(row, { includeToken = false } = {}) {
  return {
    id: row.id,
    interviewId: row.interview_id,
    reviewerName: row.reviewer_name,
    reviewerEmail: row.reviewer_email,
    overallRating: row.overall_rating,
    recommendation: row.recommendation,
    criteria: row.criteria ?? [],
    strengths: row.strengths,
    concerns: row.concerns,
    comments: row.comments,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    ...(includeToken && row.token && !row.submitted_at ? { token: row.token } : {}),
  };
}

// Submitted scorecards rolled up: how many, the average overall rating
// (one decimal) and the recommendation counts.
export function summariseScorecards(cards) {
  const done = (cards || []).filter((c) => c.submittedAt || c.submitted_at);
  const ratings = done.map((c) => c.overallRating ?? c.overall_rating).filter((n) => Number.isFinite(n));
  const recs = { strong_yes: 0, yes: 0, no: 0, strong_no: 0 };
  for (const c of done) {
    const r = c.recommendation;
    if (r in recs) recs[r] += 1;
  }
  return {
    submitted: done.length,
    pending: (cards || []).length - done.length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    recommendations: recs,
  };
}

// "Mon 5 Oct, 10:00 (45 min)" in the given time zone.
export function formatInterviewTime(startsAt, durationMinutes, timeZone = "Europe/London") {
  const d = new Date(startsAt);
  const date = d.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}${durationMinutes ? ` (${durationMinutes} min)` : ""}`;
}
