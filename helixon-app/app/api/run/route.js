import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import extractCvText, { CV_READ_ERRORS } from "@/lib/cv-analysis/extraction/cvTextExtractor";
import { detectFileFormat } from "@/lib/document/fileSignature";
import { cleanText, cleanLine, cleanEmail, cleanUuid, cleanList } from "@/lib/sanitize";
import { requireCustomerContext } from "@/lib/customer-auth";
import { capRefusal, screeningsThisMonth } from "@/lib/agency-controls";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { storeCandidateCv, removeCandidateCvs } from "@/lib/candidate-files";
import { buildReport, matchHighlights } from "@/lib/analysis-report";

import { NextResponse } from "next/server";

// A single analysis makes 2-3 Claude calls (candidate + job extraction in
// parallel - the job one skipped for a saved job - then the fit judgement),
// each with its own retry-with-backoff on transient failures
// (askClaude.js). Set explicitly so the intended timeout is visible in code
// rather than relying on the account-default execution limit. Verify this
// against your actual Vercel plan - Hobby caps function duration well
// below this regardless of what's set here.
export const maxDuration = 240;

// Analyses per signed-in user per hour - comfortably above one full bulk
// upload (50 CVs) so a batch never stalls part-way through.
const RUN_LIMIT_PER_USER_PER_HOUR = 100;

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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Recruiter must-haves are appended after the description, and the job
// extraction prompt reads MAX_JOB_CHARS (prompts/jobExtractionPrompt.js) of
// the result - a longer description used to push them past that cut-off,
// so they were silently never read. This leaves room for all of them.
const MAX_JOB_TEXT_CHARS = 28000;

// Must-haves typed on /analyse: a short line each, a handful per role.
const MAX_REQUIREMENTS = 20;
const MAX_REQUIREMENT_CHARS = 200;

// Recruiter-facing messages for a CV or job spec that couldn't be read -
// answered as a 422 rather than "something went wrong".
const READ_ERROR_MESSAGES = {
  [CV_READ_ERRORS.pdf]: "We couldn't read this PDF. Try re-saving the CV as PDF or upload a DOCX version.",
  [CV_READ_ERRORS.docx]: "We couldn't read this Word document. Try re-saving it as .docx or upload a PDF version.",
  [CV_READ_ERRORS.doc]: "Old .doc files aren't supported. Save the CV as PDF or .docx and try again.",
  [CV_READ_ERRORS.unsupported]: "That file doesn't look like a PDF or Word (.docx) document.",
};

// Job-spec upload additionally accepts .txt, which extractCvText() has no
// branch for (it's CV-focused) - read those directly instead.
async function extractJobSpecText(file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The job spec file is too large. Maximum size is 10 MB.");
  }
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  let text;
  if (type === "text/plain" || name.endsWith(".txt")) {
    text = cleanText(await file.text(), { max: MAX_JOB_TEXT_CHARS });
  } else {
    try {
      text = cleanText(await extractCvText(file), { max: MAX_JOB_TEXT_CHARS });
    } catch {
      throw new Error("Could not read the job spec file. Upload a PDF, Word (.docx) or .txt file, or paste the description.");
    }
  }
  if (!text) throw new Error("The job spec file appears to be empty.");
  return text;
}

// jobs.role_tier has a check constraint allowing only 'entry_level',
// 'skilled' and 'senior' (live DB), while job extraction uses entry /
// skilled / senior / executive (validateJob.js). Writing "entry" or
// "executive" straight through failed the insert and the whole analysis
// with a 500. The full value stays in jobs.parsed for scoring.
const DB_ROLE_TIERS = {
  entry: "entry_level",
  entry_level: "entry_level",
  skilled: "skilled",
  senior: "senior",
  executive: "senior",
};

function dbRoleTier(tier) {
  return DB_ROLE_TIERS[String(tier || "").toLowerCase()] || "skilled";
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

    // Loose per-IP guard against floods before we do any work. The real
    // allowance is per user, below - it used to be 20/hour per IP, which a
    // single 50-CV bulk upload (BULK_MAX_FILES in app/analyse) blew through
    // at file 21, and which a whole office behind one IP shared.
    const ip = getClientIp(request);

    if (!(await rateLimit(`run-ip:${ip}`, 300))) {
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
      userId,
      agencyId,
      profile,
    } = auth;

    // Optional monthly cap an admin can set per agency (Admin > Agencies).
    if (auth.screeningCap) {
      const refused = capRefusal(await screeningsThisMonth(agencyId), auth.screeningCap);
      if (refused) {
        return NextResponse.json({ ok: false, capReached: true, error: refused.error }, { status: refused.status });
      }
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Send the CV and job description as a form upload." },
        { status: 400 }
      );
    }

    const file = form.get("cv");

    // A pasted description. Checked before cleaning (which would quietly
    // cut it), so an over-long paste is refused instead of half-read.
    const rawJobText = form.get("jobText");
    if (typeof rawJobText === "string" && rawJobText.trim().length > MAX_JOB_TEXT_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: `The job description is too long. Keep it under ${MAX_JOB_TEXT_CHARS.toLocaleString("en-GB")} characters.`,
        },
        { status: 400 }
      );
    }
    let jobText = cleanText(rawJobText, { max: MAX_JOB_TEXT_CHARS });

    const jobFile = form.get("jobFile");

    // Stored on the job and later used to email the client, so it has to
    // be a real address - an invalid one is refused, not saved.
    const rawClientEmail = cleanLine(form.get("clientEmail"), 254);
    const clientEmail = rawClientEmail ? cleanEmail(rawClientEmail) : "";
    if (rawClientEmail && !clientEmail) {
      return NextResponse.json(
        { ok: false, error: "The client email doesn't look like a valid email address." },
        { status: 400 }
      );
    }

    let requirements = [];
    try {
      const rawRequirements = form.get("requirements");
      const parsedRequirements = JSON.parse(typeof rawRequirements === "string" && rawRequirements ? rawRequirements : "[]");
      // Cleaned like any other free text that ends up in a prompt, and
      // capped - they're appended to the job description below.
      requirements = cleanList(parsedRequirements, {
        maxItems: MAX_REQUIREMENTS,
        maxLength: MAX_REQUIREMENT_CHARS,
      });
    } catch {
      // Malformed requirements payload - treat as none rather than failing
      // the whole analysis over an optional field.
    }

    const blind = form.get("blind") === "true";

    // The recruiter must confirm a lawful basis for screening this CV (the
    // checkbox on /analyse). It's recorded with the analysis, so there's
    // evidence of who confirmed it and when (GDPR accountability).
    if (form.get("lawfulBasisConfirmed") !== "true") {
      return NextResponse.json(
        { ok: false, error: "Confirm you have a lawful basis to screen this CV before analysing it." },
        { status: 400 }
      );
    }

    const rawJobId = form.get("jobId") || null;
    const existingJobId = rawJobId ? cleanUuid(rawJobId) : null;
    if (rawJobId && !existingJobId) {
      return NextResponse.json(
        { ok: false, error: "That saved job could not be found." },
        { status: 404 }
      );
    }

    const saveJob =
      form.get("saveJob") === "true";

    // "Upload spec" mode never populates jobText client-side (the file is
    // extracted here, same as the CV) - only fall through to the "missing"
    // error below if there's genuinely neither a pasted description nor a
    // file to extract one from.
    if (!jobText && jobFile && typeof jobFile === "object" && jobFile.size > 0) {
      try {
        jobText = await extractJobSpecText(jobFile);
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

    if (!file || typeof file !== "object" || !file.size || !jobText) {
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

    if (file.size > MAX_UPLOAD_BYTES) {
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

    // What the file actually is, from its bytes - a renamed or corrupt
    // file is refused here, before it costs an analysis, rather than
    // failing part-way through or being stored under the wrong type.
    const cvFormat = await detectFileFormat(file);
    if (!cvFormat) {
      return NextResponse.json(
        { ok: false, error: READ_ERROR_MESSAGES[CV_READ_ERRORS.unsupported] },
        { status: 400 }
      );
    }

    // Counted only once the request is known to be valid - a rejected
    // upload (wrong file type, job text too short, etc.) used to use up one
    // of the user's hourly analyses without analysing anything.
    if (!(await rateLimit(`run-user:${userId}`, RUN_LIMIT_PER_USER_PER_HOUR))) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hourly analysis limit reached. Please try again later.",
        },
        { status: 429 }
      );
    }

    /*
     * IDOR protection: a supplied job ID must belong to this user's
     * agency. Checked BEFORE the analysis - it used to run after the
     * candidate row was inserted, so a bad jobId both burned a full
     * (paid) Claude analysis and left an orphaned candidate behind with
     * no job, score or stage.
     */
    let existingJob = null;
    if (existingJobId) {
      const { data, error: existingJobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", existingJobId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (existingJobError || !data) {
        return NextResponse.json(
          { ok: false, error: "That saved job could not be found." },
          { status: 404 }
        );
      }
      existingJob = data;
    }

    // A saved job's requirements were already extracted when it was
    // created - reuse them instead of sending the same description through
    // Claude again. This is what every CV after the first in a bulk run
    // does (BulkFlow passes the job created by the first CV). Only when the
    // text is unchanged and no extra must-haves were added; otherwise the
    // role has changed and is re-read.
    // Compared as cleaned text: jobText was cleaned above, and jobs saved
    // before that was done hold the raw paste (CRLFs, trailing spaces...).
    const sameJobText =
      typeof existingJob?.job_text === "string" &&
      cleanText(existingJob.job_text, { max: MAX_JOB_TEXT_CHARS * 2 }) === jobText;
    const knownJobParsed =
      requirements.length === 0 &&
      sameJobText &&
      existingJob.parsed &&
      Array.isArray(existingJob.parsed.required_skills)
        ? existingJob.parsed
        : null;

    const {
      cvText,
      extracted,
      result,
      jobParsed,
    } = await analyseCV(
      file,
      jobText,
      { blind, jobParsed: knownJobParsed }
    );

    // A job created by hand on the Jobs page has no parsed requirements
    // until its first screening. Keep them, so later CVs against the same
    // description reuse them instead of re-reading it every time.
    if (existingJob && !knownJobParsed && sameJobText && requirements.length === 0 && jobParsed && !existingJob.parsed?.required_skills) {
      const { error: parsedError } = await supabase
        .from("jobs")
        .update({ parsed: jobParsed })
        .eq("id", existingJob.id)
        .eq("agency_id", agencyId);
      if (parsedError) console.warn("[run] Couldn't save parsed requirements on the job:", parsedError.message);
    }

    const ex = extracted || {};

    // Everything below comes out of the model's reading of the CV - bounded
    // and cleaned like any other untrusted text before it becomes the
    // candidate's contact details (an email that isn't one is dropped
    // rather than offered to recruiters as a mailto: link).
    const candidateName = cleanLine(ex.name, 120) || "Candidate";
    const contact = {
      email: cleanEmail(ex.email) || null,
      phone: cleanLine(ex.phone, 40) || null,
      linkedin: cleanLine(ex.linkedin, 200) || null,
      current_title: cleanLine(ex.current_title, 160) || null,
      current_company: cleanLine(ex.current_employer, 160) || null,
      location: cleanLine(ex.location, 120) || null,
    };

    let salary = null;

    try {
      salary = estimateSalary(ex, {
        relevantYears: result?.relevant_years_experience ?? null,
        job: jobParsed || {},
      });
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
        name: candidateName,
        full_name: candidateName,
        ...contact,
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

    // Anything created from here on is removed again if a later step
    // fails, so a half-finished analysis never shows up in the pipeline.
    let createdJobId = null;
    let createdScoreId = null;
    const cleanup = async () => {
      if (createdScoreId) await supabase.from("scores").delete().eq("id", createdScoreId);
      await supabase.from("candidates").delete().eq("id", candidate.id);
      if (createdJobId) await supabase.from("jobs").delete().eq("id", createdJobId);
    };

    let job;
    if (existingJob) {
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
          role_tier: dbRoleTier(jobParsed?.role_tier),
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
        await cleanup();
        throw new Error(jobError.message);
      }
      job = newJob;
      createdJobId = newJob.id;
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
          // Read by the candidate page to warn before opening the original
          // CV of someone screened blind.
          blind_mode: blind,
          lawful_basis: { confirmed: true, by: recruiterDisplayName(profile) || userId, at: new Date().toISOString() },
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
      await cleanup();
      throw new Error(scoreError.message);
    }
    createdScoreId = score.id;

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
    // Keep the original CV file so recruiters can preview, download and
    // send it (lib/candidate-files.js) - only the extracted text used to be
    // kept. Stored after every other write has succeeded, so the cleanup()
    // path above never has a file to leave behind, and a storage failure
    // never costs the analysis itself: the candidate just has no file.
    let storedCv = null;
    try {
      storedCv = await storeCandidateCv({ agencyId, candidateId: candidate.id, file, format: cvFormat });
    } catch (err) {
      console.error("[run] Failed to store CV file:", err?.message);
    }

    const { error: candidateUpdateError } = await supabase
      .from("candidates")
      .update({
        stage: "Screened",
        match_score: result?.match_score ?? 0,
        recommendation: result?.recommendation || "Review",
        job_id: job.id,
        // The profile's "Why they match" reads these - they were never
        // written, so every profile said "None recorded" / "No concerns
        // flagged" even when the analysis had found red flags.
        ...matchHighlights(result),
        ...(storedCv ? { cv_file_url: storedCv.path, cv_filename: storedCv.fileName } : {}),
      })
      .eq("id", candidate.id);

    if (candidateUpdateError) {
      // Without this update the candidate has no stage, job or score on
      // its own row, so it never shows in the pipeline, job or candidate
      // lists - it used to be kept anyway and reported as a success.
      // Undo the whole analysis so the recruiter can simply retry.
      // The file isn't linked to the candidate, so nothing could ever
      // reach or delete it - remove it rather than orphan a CV.
      if (storedCv) await removeCandidateCvs([storedCv.path]);
      await cleanup();
      throw new Error(`Failed to update candidate with analysis result: ${candidateUpdateError.message}`);
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
          recruiterDisplayName(profile) || userId,
        meta: {
          job_id: job.id,
          score_id: score.id,
          match_score:
            result?.match_score ?? 0,
          lawful_basis_confirmed: true,
        },
      });

    return NextResponse.json({
      ok: true,

      result: buildReport(result, ex, { salary, blind }),

      candidateId: candidate.id,
      jobId: job.id,
      scoreId: score.id,

      job: {
        id: job.id,
        title: job.title,
        is_saved: job.is_saved,
        status: job.status,
      },

      // The live pipeline stage (candidates.stage), not the legacy
      // scores.stage history value ("new").
      stage: "Screened",
    });
  } catch (error) {
    console.error(
      "[run] Error:",
      error
    );

    // Only messages extractCvText() is known to throw are shown - anything
    // else (database errors etc.) stays in the log, not the response.
    const readError =
      typeof error?.message === "string" && Object.hasOwn(READ_ERROR_MESSAGES, error.message)
        ? READ_ERROR_MESSAGES[error.message]
        : null;

    return NextResponse.json(
      {
        ok: false,
        error: readError || "Something went wrong analysing this candidate.",
      },
      {
        status: readError
          ? 422
          : 500,
      }
    );
  }
}