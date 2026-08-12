import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Feature 1: list every saved job role for an agency, with a running
// candidate count, for the /jobs list page.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get("agencyId");

    if (!agencyId) {
      return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title, status, is_saved, created_at")
      .eq("agency_id", agencyId)
      .eq("is_saved", true)
      .order("created_at", { ascending: false });

    if (jobsError) throw new Error(jobsError.message);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ ok: true, jobs: [] });
    }

    // One count query per job kept simple/explicit rather than a join,
    // since saved-job lists are small (an agency's open roles, not its
    // whole history).
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const { count } = await supabase
          .from("scores")
          .select("*", { count: "exact", head: true })
          .eq("job_id", job.id);
        return { ...job, candidate_count: count || 0 };
      })
    );

    return NextResponse.json({ ok: true, jobs: jobsWithCounts });

  } catch (err) {
    console.error("[jobs] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}