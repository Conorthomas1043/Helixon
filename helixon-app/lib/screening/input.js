// Reading and checking a screening request (POST /api/run): the CV, the job
// description (pasted, uploaded or a saved job), the recruiter's extra
// must-haves and the lawful-basis confirmation. Everything here is checked
// before any model call or database write.

import extractCvText from "@/lib/cv-analysis/extraction/cvTextExtractor";

export const MAX_JOB_TEXT = 50000;
export const MIN_JOB_TEXT = 50;
export const MAX_CV_BYTES = 10 * 1024 * 1024;

// .doc isn't accepted: extractCvText() has no parser for the legacy binary
// format and always throws for it, so accepting it would only produce a 400
// after the upload.
const ACCEPTED_CV_MIME_TYPES = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const ACCEPTED_CV_EXTENSIONS = [".pdf", ".docx"];

export function isAcceptedCvFile(file) {
  if (!file) return false;
  if (file.type && ACCEPTED_CV_MIME_TYPES.has(file.type)) return true;
  const name = (file.name || "").toLowerCase();
  return ACCEPTED_CV_EXTENSIONS.some((ext) => name.endsWith(ext));
}

// A job spec upload may also be plain text, which the CV extractor doesn't
// read.
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

function parseRequirements(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map((r) => (typeof r === "string" ? r.trim() : "")).filter(Boolean) : [];
  } catch {
    // An optional field: malformed means none, not a failed screening.
    return [];
  }
}

/**
 * Reads the form and checks it. Returns { error, status } for a request to
 * refuse, or { input } with everything the screening needs.
 *
 * @param {FormData} form
 */
export async function readScreeningForm(form) {
  // The recruiter confirms a lawful basis for screening this CV (the checkbox
  // on /analyse). It's recorded with the analysis: who confirmed it, and when.
  if (form.get("lawfulBasisConfirmed") !== "true") {
    return { status: 400, error: "Confirm you have a lawful basis to screen this CV before analysing it." };
  }

  // A form field can be a string; only a real upload counts.
  const cv = form.get("cv");
  const file = cv && typeof cv === "object" ? cv : null;
  const jobFile = form.get("jobFile");
  const requirements = parseRequirements(form.get("requirements"));
  let jobText = String(form.get("jobText") || "").trim();

  // "Upload spec" mode sends a file instead of text.
  if (!jobText && jobFile && typeof jobFile === "object" && jobFile.size > 0) {
    try {
      jobText = (await extractJobSpecText(jobFile)).trim();
    } catch (err) {
      return { status: 400, error: err?.message || "Could not read the job spec file." };
    }
  }

  // Extra must-haves go into the description itself, so job extraction
  // treats them as first-class requirements.
  if (requirements.length > 0) {
    jobText = `${jobText}\n\nAdditional must-have requirements specified by the recruiter:\n${requirements.map((r) => `- ${r}`).join("\n")}`;
  }

  if (!file || !jobText) return { status: 400, error: "A CV and job description are required." };
  if (!isAcceptedCvFile(file)) return { status: 400, error: "Unsupported CV file. Upload a PDF or DOCX file." };
  if (file.size > MAX_CV_BYTES) return { status: 400, error: "CV file is too large. Maximum size is 10 MB." };
  if (jobText.length < MIN_JOB_TEXT) return { status: 400, error: "The job description must contain at least 50 characters." };
  // The same ceiling as the public API: the description goes to the model
  // with every screening and is stored on the job.
  if (jobText.length > MAX_JOB_TEXT) return { status: 400, error: "The job description is too long - keep it under 50,000 characters." };

  return {
    input: {
      file,
      jobText,
      requirements,
      blind: form.get("blind") === "true",
      clientEmail: String(form.get("clientEmail") || "").trim(),
      existingJobId: form.get("jobId") || null,
      saveJob: form.get("saveJob") === "true",
    },
  };
}

/**
 * A saved job's requirements, when they can be reused instead of reading the
 * description again: the text is unchanged and no must-haves were added.
 * Every CV after the first in a bulk run takes this path.
 */
export function reusableJobParsed(existingJob, { jobText, requirements }) {
  const sameText = Boolean(existingJob?.job_text) && existingJob.job_text.trim() === jobText.trim();
  return requirements.length === 0 && sameText && Array.isArray(existingJob?.parsed?.required_skills) ? existingJob.parsed : null;
}

// The user-facing message (and status) for a screening that threw.
export function screeningFailure(error) {
  const message = error?.message || "";
  if (message.includes("Unable to extract text from PDF") || message.includes("PDF contained")) {
    return { status: 422, error: "We couldn't read this PDF. Try re-saving the CV as PDF or upload a DOCX version." };
  }
  if (message.includes("Unable to extract text from DOCX") || message.includes("DOCX contained")) {
    return {
      status: 422,
      error:
        "We couldn't read this Word file. If it's an old .doc renamed to .docx, password-protected, or only contains images, open it in Word and save it again as .docx or PDF.",
    };
  }
  return { status: 500, error: "Something went wrong analysing this candidate." };
}
