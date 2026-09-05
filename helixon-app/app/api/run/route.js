import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";

import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import { getScoreBand } from "@/lib/scoreBands";
import { requireCustomerContext } from "@/lib/customer-auth";

import { NextResponse } from "next/server";

const ACCEPTED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ACCEPTED_CV_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
];

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

    const ip =
      request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

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
    const jobText = String(
      form.get("jobText") || ""
    ).trim();

    const blind = form.get("blind") === "true";

    const existingJobId =
      form.get("jobId") || null;

    const saveJob =
      form.get("saveJob") === "true";

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
            "Unsupported CV file. Upload a PDF, DOC or DOCX file.",
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
        stage: "new",
      })
      .select()
      .single();

    if (scoreError) {
      throw new Error(scoreError.message);
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