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
