// app/api/candidates/[id]/feedback-requests/route.js
// Recruiter-side: generate a feedback-request link for a candidate (their
// own NPS-style survey) or for a hiring-manager/client contact (candidate
// fit/quality rating), and list the ones already sent for this candidate.
// The link itself is answered on an unauthenticated public page
// (app/feedback/[token]) since neither a candidate nor a client contact
// has a Helixon account - see app/api/feedback-requests/[token]/route.js.

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanLine } from "@/lib/sanitize";

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

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("feedback_requests")
    .select("id, kind, recipient_label, rating, comment, tags, token, created_at, responded_at")
    .eq("candidate_id", id)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[feedback-requests] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to load feedback requests." }, { status: 500 });
  }

  return NextResponse.json({ requests: (data || []).map(shape) });
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const kind = body?.kind;
  if (!KIND_VALUES.has(kind)) {
    return NextResponse.json({ error: "Invalid feedback request kind." }, { status: 400 });
  }
  const recipientLabel = cleanLine(body?.recipientLabel, 120) || null;

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id, job_id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (candidateError || !candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = crypto.randomBytes(24).toString("hex");

  const { data, error } = await supabase
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
    console.error("[feedback-requests] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to create feedback request." }, { status: 500 });
  }

  return NextResponse.json({ request: shape(data) });
}
