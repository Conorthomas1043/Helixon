import { supabase } from "@/lib/supabase";
import { analyseCV } from "@/lib/cv-analysis";
import { getScoreBand } from "@/lib/scoreBands";
import { NextResponse } from "next/server";

// Feature 1: same scoring logic as the single-CV /api/run flow, but takes
// an existing jobId instead of new job text, so the recruiter just
// uploads more CVs against a role they've already saved. Nothing about
// the evidence-based scoring prompt changes - this only reuses job_text.
//
// Fix: was importing a non-existent `analyseSingleCv` - lib/cv-analysis
// only ever exported `analyseCV` (see pipeline/analyseCV.js). Also,
// scoreCandidate's real return shape has no `match_score`/`recommendation`
// fields - it returns `overall` instead, and doesn't produce a
// recommendation string at all right now. match_score is mapped from
// `overall` below; recommendation is left null until that's reinstated
// upstream in scoreCandidate (flagged, not silently invented here).

const BATCH_SIZE = 5;

export async function POST(request, { params }) {
  try {
    const { id: jobId } = params;
    const form      = await request.formData();
    const cvFiles   = form.getAll("cvs");
    const agencyId  = form.get("agencyId");

    if (!agencyId) {
      return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
    }
    if (!cvFiles || cvFiles.length === 0) {
      return NextResponse.json({ ok: false, error: "No CVs provided" }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("agency_id", agencyId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    for (const file of cvFiles) {
      if (file.type && file.type !== "application/pdf") {
        return NextResponse.json(
          { ok: false, error: `${file.name || "One of the files"} is not a PDF.` },
          { status: 400 }
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: `${file.name || "One of the files"} is too large. Maximum size is 10 MB.` },
          { status: 400 }
        );
      }
    }

    const allResults = [];

    for (let i = 0; i < cvFiles.length; i += BATCH_SIZE) {
      const batch = cvFiles.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const { cvText, extracted: ex, result } =
            await analyseCV(file, job.job_text);

          const { data: candidate, error: candError } = await supabase
            .from("candidates")
            .insert({
              agency_id: agencyId,
              name:      ex.name,
              cv_text:   cvText,
              extracted: ex,
            })
            .select()
            .single();
          if (candError) throw new Error(candError.message);

          const { data: scoreRow, error: scoreError } = await supabase
            .from("scores")
            .insert({
              agency_id:      agencyId,
              candidate_id:   candidate.id,
              job_id:         jobId,
              match_score:    result.overall,
              recommendation: result.recommendation ?? null,
              result,
              stage:          "new",
              source:         "bulk",
            })
            .select()
            .single();
          if (scoreError) throw new Error(scoreError.message);

          return {
            ...result,
            name:         ex.name,
            candidateId:  candidate.id,
            score_id:     scoreRow.id,
            stage:        scoreRow.stage,
            score_band:   getScoreBand(result.overall),
          };
        })
      );

      allResults.push(...batchResults);
    }

    allResults.sort((a, b) => b.overall - a.overall);

    return NextResponse.json({ ok: true, results: allResults, jobId });

  } catch (err) {
    console.error("[jobs/:id/add-candidates] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}