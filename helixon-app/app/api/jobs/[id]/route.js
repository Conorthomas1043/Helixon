import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*, candidates(id, processing_status, stage, match_score)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const completed = job.candidates.filter((c) => c.processing_status === "completed");
  return NextResponse.json({
    ...job,
    candidates: undefined,
    candidateCount: job.candidates.length,
    strongMatches: completed.filter((c) => c.match_score !== null && c.match_score >= 80).length,
    shortlisted: completed.filter((c) => c.stage === "Shortlisted").length,
    interviewing: completed.filter((c) => c.stage === "Interview").length,
    offers: completed.filter((c) => c.stage === "Offer").length,
    placed: completed.filter((c) => c.stage === "Placed").length,
  });
}

const VALID_STATUSES = new Set(["open", "closed"]);

// Replaces app/api/jobs/[id]/update-status (retired - no auth, no agency
// check, and broken on every call from reading `params` without awaiting
// it). The only mutation Jobs needed and didn't have: marking a role
// filled/closed, or reopening it - everything else about a job (title,
// requirements, skills) is set once at creation from the parsed job
// description and isn't user-editable here.
export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "status must be 'open' or 'closed'." }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to update job status." }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: job.status });
}
