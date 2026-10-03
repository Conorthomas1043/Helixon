import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { logActivity } from "@/lib/candidate-activity";
import { REFERENCE_QUESTIONS, cleanReferenceAnswers } from "@/lib/compliance";
import { notify } from "@/lib/notifications";

// Public: a referee's reference form (app/reference/[token]). The token is
// the only credential, so this answers with only what the form needs - the
// candidate's name and the agency's - and accepts one answer.

const TOKEN_RE = /^[a-f0-9]{48}$/;

async function load(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data } = await supabase
    .from("candidate_references")
    .select("id, agency_id, candidate_id, referee_name, status, expires_at, candidates(full_name, name), agencies(name)")
    .eq("token", token)
    .maybeSingle();
  return data;
}

const expired = (row) => row.expires_at && new Date(row.expires_at).getTime() < Date.now();

export async function GET(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`reference-get:${getClientIp(request)}`, 120))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  return NextResponse.json({
    candidateName: row.candidates?.full_name || row.candidates?.name || "the candidate",
    agencyName: row.agencies?.name ?? null,
    refereeName: row.referee_name,
    status: row.status,
    expired: row.status === "requested" && expired(row),
    questions: REFERENCE_QUESTIONS,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  if (!(await rateLimit(`reference-post:${getClientIp(request)}`, 20))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const row = await load(token);
  if (!row) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (row.status !== "requested") return NextResponse.json({ error: "This reference has already been answered." }, { status: 409 });
  if (expired(row)) return NextResponse.json({ error: "This link has expired - please ask the agency for a new one." }, { status: 410 });

  const body = await request.json().catch(() => ({}));
  let update;
  if (body.decline === true) {
    update = { status: "declined", received_at: new Date().toISOString() };
  } else {
    const r = cleanReferenceAnswers(body);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    update = { status: "received", received_at: new Date().toISOString(), answers: r.answers };
  }
  const { data, error } = await supabase.from("candidate_references").update(update).eq("id", row.id).eq("status", "requested").select("id");
  if (error) return NextResponse.json({ error: "Couldn't save your reference." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "This reference has already been answered." }, { status: 409 });
  await logActivity(supabase, row.candidate_id, "reference_received", update.answers?.completedBy || row.referee_name, {
    note: update.status === "declined" ? `${row.referee_name} declined to give a reference` : `From ${row.referee_name}`,
  });
  const { data: owner } = await supabase.from("candidates").select("recruiter_id").eq("id", row.candidate_id).maybeSingle();
  await notify({
    agencyId: row.agency_id,
    userId: owner?.recruiter_id || null,
    kind: "reference",
    title: update.status === "declined" ? `${row.referee_name} declined a reference` : `Reference received from ${row.referee_name}`,
    body: row.candidates?.full_name || row.candidates?.name || null,
    href: `/dashboard/candidates/${row.candidate_id}`,
  });
  after(() =>
    emitWebhook(row.agency_id, "reference.received", { referenceId: row.id, candidateId: row.candidate_id, referee: row.referee_name, status: update.status, answers: update.answers ?? null })
  );
  return NextResponse.json({ ok: true });
}
