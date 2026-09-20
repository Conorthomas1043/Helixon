import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import extractCvText from "@/lib/cv-analysis/extraction/cvTextExtractor";
import { getScoreBand } from "@/lib/scoreBands";
import { requireCustomerContext } from "@/lib/customer-auth";

import { NextResponse } from "next/server";

// .doc is deliberately not accepted - extractCvText() has no parser for
// the legacy binary format and always throws for it (see that file), so
// advertising support for it just produces a 400 after the user waits on
// the upload. PDF/DOCX cover what's actually implemented.
const ACCEPTED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ACCEPTED_CV_EXTENSIONS = [
  ".pdf",
  ".docx",
];

// Job-spec upload additionally accepts .txt, which extractCvText() has no
// branch for (it's CV-focused) - read those directly instead.
async function extractJobSpecText(file) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  if (type === "text/plain" || name.endsWith(".txt")) {
    const text = await file.text();
    if (!text || !text.trim()) throw new Error("The job spec file appears to be empty.");
    return text.trim();
  }
  return extractCvText(file);
}

function isAcceptedCvFile(file) {
  if (!file) return false;

  if (
    file.type &&
    ACCEPTED_CV_MIME_TYPES.has(file.type)
  ) {
    return true;
  }

  const name = (file.name || "").toLowerCase();

  return ACCEPTED_CV_EXTENSIONS.some((ext) =>
    name.endsWith(ext)
  );
}

function redactExtracted(ex = {}) {
  return {
    ...ex,
    name: "Candidate",
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    portfolio_url: null,
    location: null,
    current_employer: null,

    education: (ex.education || []).map((item) => ({
      ...item,
      institution: item.institution
        ? item.institution.replace(/./g, "█")
        : item.institution,
    })),
  };
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Screening service is not configured.",
        },
        { status: 500 }
      );
    }

    const ip = getClientIp(request);

    if (!(await rateLimit(ip))) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    /*
     * IMPORTANT:
     * The agency is resolved from the authenticated
     * user's profile. Nothing supplied by the browser
     * can override it.
     *
     * The old code accepted:
     *   formData.agencyId
     *
     * That is deliberately gone.
     */
    const auth = await requireCustomerContext({
      requireSubscription: true,
    });

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          upgrade: auth.upgrade || false,
          error: auth.error,
        },
        { status: auth.status }
      );
    }

    const {
      user,
      userId,
      agencyId,
    } = auth;

    const form = await request.formData();

    const file = form.get("cv");
    let jobText = String(
      form.get("jobText") || ""
    ).trim();

    const jobFile = form.get("jobFile");
    const clientEmail = String(
      form.get("clientEmail") || ""
    ).trim();

    let requirements = [];
    try {
      const parsedRequirements = JSON.parse(form.get("requirements") || "[]");
      if (Array.isArray(parsedRequirements)) {
        requirements = parsedRequirements
          .map((r) => (typeof r === "string" ? r.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // Malformed requirements payload - treat as none rather than failing
      // the whole analysis over an optional field.
    }

    const blind = form.get("blind") === "true";

    const existingJobId =
      form.get("jobId") || null;

    const saveJob =
      form.get("saveJob") === "true";

    // "Upload spec" mode never populates jobText client-side (the file is
    // extracted here, same as the CV) - only fall through to the "missing"
    // error below if there's genuinely neither a pasted description nor a
    // file to extract one from.
    if (!jobText && jobFile && typeof jobFile === "object" && jobFile.size > 0) {
      try {
        jobText = (await extractJobSpecText(jobFile)).trim();
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            error: err?.message || "Could not read the job spec file.",
          },
          { status: 400 }
        );
      }
    }

    // Recruiter-specified must-haves are folded into the job description
    // text itself, so the existing job/requirements extractor (and the
    // requirements_met reconciliation already built on top of it) picks
    // them up as first-class requirements rather than needing a second,
    // parallel matching path.
    if (requirements.length > 0) {
      jobText = `${jobText}\n\nAdditional must-have requirements specified by the recruiter:\n${requirements
        .map((r) => `- ${r}`)
        .join("\n")}`;
    }

    if (!file || !jobText) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A CV and job description are required.",
        },
        { status: 400 }
      );
    }

    if (!isAcceptedCvFile(file)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported CV file. Upload a PDF or DOCX file.",
        },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "CV file is too large. Maximum size is 10 MB.",
        },
        { status: 400 }
      );
    }

    if (jobText.length < 50) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The job description must contain at least 50 characters.",
        },
        { status: 400 }
      );
    }

    const {
      cvText,
      extracted,
      result,
      jobParsed,
    } = await analyseCV(
      file,
      jobText
    );

    const ex = extracted || {};

    let salary = null;

    try {
      salary = estimateSalary(ex);
    } catch (error) {
      console.warn(
        "[run] Salary estimate failed:",
        error?.message
      );
    }

    /*
     * Candidate belongs to the authenticated user's
     * agency, never to an agency supplied by the client.
     */
    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidates")
      .insert({
        agency_id: agencyId,
        user_id: userId,
        recruiter_id: userId,
        name: ex.name || "Candidate",
        full_name:
          ex.name || "Candidate",
        email: ex.email || null,
        phone: ex.phone || null,
        linkedin: ex.linkedin || null,
        current_title:
          ex.current_title || null,
        current_company:
          ex.current_employer || null,
        location: ex.location || null,
        cv_text: cvText || "",
        extracted: ex,
        processing_status: "completed",
      })
      .select()
      .single();

    if (candidateError) {
      throw new Error(
        candidateError.message
      );
    }

    let job;

    if (existingJobId) {
      /*
       * IDOR protection:
       * even when a job ID is supplied, it must belong
       * to this user's agency.
       */
      const {
        data: existingJob,
        error: existingJobError,
      } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", existingJobId)
        .eq("agency_id", agencyId)
        .single();

      if (existingJobError || !existingJob) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "That saved job could not be found.",
          },
          { status: 404 }
        );
      }

      job = existingJob;
    } else {
      const {
        data: newJob,
        error: jobError,
      } = await supabase
        .from("jobs")
        .insert({
          agency_id: agencyId,
          user_id: userId,
          title:
            jobParsed?.title ||
            "Untitled Role",
          client:
            jobParsed?.client ||
            null,
          client_email:
            clientEmail ||
            jobParsed?.client_email ||
            null,
          job_text: jobText,
          parsed: jobParsed || {},
          role_tier:
            jobParsed?.role_tier ||
            "skilled",
          is_saved: saveJob,
          status: "open",
          location:
            jobParsed?.location ||
            null,
          employment_type:
            jobParsed?.employment_type ||
            null,
          seniority:
            jobParsed?.seniority ||
            null,
          salary_range:
            jobParsed?.salary_range ||
            null,
          required_skills:
            jobParsed?.required_skills ||
            [],
          preferred_skills:
            jobParsed?.preferred_skills ||
            [],
          min_years_experience:
            jobParsed?.min_years_experience ||
            null,
        })
        .select()
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      job = newJob;
    }

    const {
      data: score,
      error: scoreError,
    } = await supabase
      .from("scores")
      .insert({
        agency_id: agencyId,
        candidate_id: candidate.id,
        job_id: job.id,
        user_id: userId,
        match_score:
          result?.match_score ?? 0,
        recommendation:
          result?.recommendation ||
          "Review",
        result: {
          ...(result || {}),
          salary_estimate: salary,
        },
        source: "single",
        // scores.stage has its OWN check constraint - a separate, legacy
        // lowercase vocabulary (new/shortlisted/contacted/interview/offer/
        // placed/rejected/waitlist), NOT the Title Case funnel in
        // lib/stage-labels.js that candidates.stage uses. Writing
        // "Screened" here violates that constraint and throws on every
        // single analysis (verified against the live DB: 101 existing
        // scores rows are all stage="new", zero ever made it to
        // "Screened" - this insert has never once succeeded with that
        // value). scores is an append-only history row per analysis, not
        // the live pipeline position, so "new" (freshly scored) is
        // correct here regardless - the actual, continuously-updated
        // stage recruiters work from lives on candidates.stage below.
        stage: "new",
      })
      .select()
      .single();

    if (scoreError) {
      throw new Error(scoreError.message);
    }

    /*
     * Denormalise the score's stage/match/recommendation and the job
     * link onto the candidate row itself. `scores` is the append-only
     * record of each analysis; `candidates.stage`/`match_score`/`job_id`
     * are what the candidates/pipeline/jobs/team API routes (and the
     * dashboard pages built on them) read and update as a recruiter
     * works the pipeline - they need a starting value from the analysis
     * that created this candidate.
     *
     * candidates has no `status` column (only `processing_status`, set on
     * the insert above) - a stray `status` field here made this whole
     * update fail on every call (PostgREST rejects unknown columns), so
     * stage/match_score/recommendation/job_id silently never landed on
     * the candidate row. Confirmed against the live DB: all 84 existing
     * candidates have stage=NULL. Checking the error now instead of
     * discarding it so a future failure here is visible in logs rather
     * than silently leaving the candidate stuck with no stage or score.
     */
    const { error: candidateUpdateError } = await supabase
      .from("candidates")
      .update({
        stage: "Screened",
        match_score: result?.match_score ?? 0,
        recommendation: result?.recommendation || "Review",
        job_id: job.id,
      })
      .eq("id", candidate.id);

    if (candidateUpdateError) {
      console.error("[run] Failed to update candidate with analysis result:", candidateUpdateError.message);
    }

    /*
     * Keep candidate activity useful for the CRM/admin
     * timeline.
     */
    await supabase
      .from("candidate_activity")
      .insert({
        candidate_id:
          candidate.id,
        type: "screened",
        actor:
          user.email || userId,
        meta: {
          job_id: job.id,
          score_id: score.id,
          match_score:
            result?.match_score ?? 0,
        },
      });

    const displayEx = blind
      ? redactExtracted(ex)
      : ex;

    return NextResponse.json({
      ok: true,

      result: {
        match_score:
          result?.match_score ?? 0,

        skill_score:
          result?.skill_score ?? null,

        experience_score:
          result?.experience_score ?? null,

        culture_score:
          result?.culture_score ?? null,

        score_band: getScoreBand(
          result?.match_score ?? 0
        ),

        recommendation:
          result?.recommendation ||
          "Review",

        summary:
          result?.summary || "",

        confidence:
          result?.confidence ?? null,

        score_rationale:
          result?.score_rationale ??
          null,

        matched_skills:
          result?.matched_skills ||
          [],

        missing_skills:
          result?.missing_skills ||
          [],

        missing_required:
          result?.missing_required ||
          [],

        missing_preferred:
          result?.missing_preferred ||
          [],

        other_skills:
          result?.other_skills ||
          [],

        strengths:
          result?.strengths || [],

        weaknesses:
          result?.weaknesses ||
          [],

        red_flags:
          result?.red_flags || [],

        standout_factors:
          result?.standout_factors ||
          [],

        interview_questions:
          result?.interview_questions ||
          [],

        requirements_met:
          result?.requirements_met ||
          [],

        experience_breakdown:
          displayEx.experience_breakdown ||
          [],

        cv_quality_issues:
          displayEx.cv_quality_issues ||
          [],

        education:
          displayEx.education || [],

        certifications:
          displayEx.certifications ||
          [],

        languages:
          displayEx.languages || [],

        name:
          displayEx.name,

        email:
          displayEx.email ?? null,

        phone:
          displayEx.phone ?? null,

        linkedin:
          displayEx.linkedin ?? null,

        github:
          displayEx.github ?? null,

        portfolio_url:
          displayEx.portfolio_url ??
          null,

        location:
          displayEx.location ?? null,

        current_title:
          displayEx.current_title ??
          null,

        current_employer:
          displayEx.current_employer ??
          null,

        notice_period:
          displayEx.notice_period ??
          null,

        willing_to_relocate:
          displayEx.willing_to_relocate ??
          null,

        salary_estimate: salary,

        blind_mode: blind,
      },

      candidateId: candidate.id,
      jobId: job.id,
      scoreId: score.id,

      job: {
        id: job.id,
        title: job.title,
        is_saved: job.is_saved,
        status: job.status,
      },

      stage: score.stage,
    });
  } catch (error) {
    console.error(
      "[run] Error:",
      error
    );

    const message =
      error?.message || "";

    const pdfError =
      message.includes(
        "Unable to extract text from PDF"
      ) ||
      message.includes(
        "PDF contained"
      );

    return NextResponse.json(
      {
        ok: false,
        error: pdfError
          ? "We couldn't read this PDF. Try re-saving the CV as PDF or upload a DOCX version."
          : "Something went wrong analysing this candidate.",
      },
      {
        status: pdfError
          ? 422
          : 500,
      }
    );
  }
}