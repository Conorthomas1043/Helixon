import { supabase } from "@/lib/supabase";
import { scoreCandidate, candidateExtractor, jobExtractor } from "@/lib/cv-analysis";
import { getScoreBand } from "@/lib/scoreBands";
import { NextResponse } from "next/server";

// Schema note (Features 1 & 2 — no scoring-logic changes, workflow columns only):
//   jobs.is_saved   boolean  default false
//   jobs.status     text     default 'open'
//   scores.stage    text     default 'new'
//
// Fix: was importing non-existent `extractCandidate`/`extractJob` — the
// real exports are `candidateExtractor`/`jobExtractor` (see
// lib/cv-analysis/extraction/*.js). Also corrected the scoreCandidate
// call: its real signature is (candidate, job, rawCV) — this was calling
// it as (cvText, jobText, extracted, jobParsed), which doesn't match at
// all. Now passes extracted candidate JSON, parsed job JSON, and the raw
// CV text (previously dropped entirely, which weakens the
// achievement/evidence scoring inside scoreCandidate).
//
// Same match_score/recommendation mapping fix as add-candidates/route.js
// — scoreCandidate returns `overall`, not `match_score`, and has no
// `recommendation` field right now. recommendation is left null pending
// that being reinstated upstream.

export async function POST(request) {
  try {
    const { candidateId, jobId, agencyId } = await request.json();

    if (!candidateId || !jobId || !agencyId) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch candidate + job in parallel
    const [{ data: cand, error: candError }, { data: job, error: jobError }] =
      await Promise.all([
        supabase.from("candidates").select("*").eq("id", candidateId).single(),
        supabase.from("jobs").select("*").eq("id", jobId).single(),
      ]);

    if (candError) throw new Error(`Candidate not found: ${candError.message}`);
    if (jobError)  throw new Error(`Job not found: ${jobError.message}`);

    // Feature 2 Part A: a closed job can still be re-scored against (e.g.
    // re-running an old candidate for record-keeping), but the frontend
    // should surface job.status so the recruiter knows it's closed.
    const extracted = cand.extracted  || (await candidateExtractor(cand.cv_text));
    const jobParsed = job.parsed      || (await jobExtractor(job.job_text));

    const result = await scoreCandidate(
      extracted,
      jobParsed,
      cand.cv_text
    );

    // Feature 2 Part B: every new score starts at stage "new", independent
    // of the job's own status (Feature 2 Part A) and independent of any
    // other candidate's stage against this same job.
    const { data, error } = await supabase
      .from("scores")
      .insert({
        agency_id:      agencyId,
        candidate_id:   candidateId,
        job_id:         jobId,
        match_score:    result.overall,
        recommendation: result.recommendation ?? null,
        result,
        stage:          "new",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      score: data,
      // Feature 3: display band for this score, computed fresh — no schema change.
      score_band: getScoreBand(result.overall),
      // Feature 1 & 2: job save-state/status alongside the score, so the
      // frontend can render both without a second call.
      job: {
        id:       job.id,
        title:    job.title,
        is_saved: job.is_saved ?? false,
        status:   job.status ?? "open",
      },
    });

  } catch (err) {
    console.error("[score] Error:", err.message);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}