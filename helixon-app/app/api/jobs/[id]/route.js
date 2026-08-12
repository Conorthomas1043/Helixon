import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Feature 2: powers the job detail page — the job itself (title, status)
// plus every candidate ever scored against it, each carrying its own
// stage. This is the "single place a role's entire candidate history
// lives" the doc describes.
export async function GET(request, { params }) {
  try {
    const { id: jobId } = params;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, job_text, status, is_saved, created_at")
      .eq("id", jobId)
      .single();

    if (jobError) throw new Error(`Job not found: ${jobError.message}`);

    // Join scores -> candidates so each row has both the score/stage and
    // the candidate's display name in one query.
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select("id, match_score, recommendation, stage, created_at, candidates(id, name)")
      .eq("job_id", jobId)
      .order("match_score", { ascending: false });

    if (scoresError) throw new Error(scoresError.message);

    const candidates = (scores || []).map((s) => ({
      score_id:       s.id,
      candidate_id:   s.candidates?.id ?? null,
      name:           s.candidates?.name ?? "Unknown",
      match_score:    s.match_score,
      recommendation: s.recommendation,
      stage:          s.stage || "new",
      scored_at:      s.created_at,
    }));

    return NextResponse.json({
      ok: true,
      job: {
        id:       job.id,
        title:    job.title,
        status:   job.status,
        is_saved: job.is_saved,
      },
      candidates,
    });

  } catch (err) {
    console.error("[jobs/:id] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}