import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;
  const { id } = await params;

  // Confirm the job belongs to this agency before listing its candidates -
  // job_id alone isn't enough to trust, since it's just a path param.
  const { data: job } = await supabase.from("jobs").select("id").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("candidates")
    .select("id, full_name, name, processing_status, stage, match_score, recruiter_id, created_at")
    .eq("job_id", id)
    .eq("agency_id", agencyId)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const recruiterNames = await resolveRecruiterNames(supabase, (data ?? []).map((c) => c.recruiter_id));

  return NextResponse.json(
    (data ?? []).map((c) => ({
      id: c.id,
      fullName: c.full_name || c.name || "Unnamed candidate",
      status: c.processing_status,
      stage: c.stage,
      score: c.match_score,
      recruiterId: c.recruiter_id,
      recruiterName: recruiterNames.get(c.recruiter_id) ?? null,
      createdAt: c.created_at,
    }))
  );
}
