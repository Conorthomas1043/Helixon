// Shared constants and helpers for the /analyse workspace (single + bulk).

import { STRONG_MATCH_MIN, REVIEW_MIN } from "@/lib/scoreBands";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MIN_LOADING_MS = 900;
export const SCORING_VERSION = "2026-07-v1";
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BULK_MAX_FILES = 50;
// Each CV after the first reuses the parsed job and makes 1-2 Claude calls
// (was 5), so more can safely run at once. Raise further only if your
// Anthropic rate limit allows - a 429 pauses the run for Retry.
export const BULK_CONCURRENCY = 4;

// What the running view walks through while /api/run works. The server
// doesn't stream progress, so these advance on a timer - they describe the
// real pipeline order, not live status.
export const RUN_STEPS = [
  { label: "Reading the CV", detail: "Text, sections and contact details" },
  { label: "Parsing the role", detail: "Required vs preferred, seniority" },
  { label: "Weighing the evidence", detail: "Skills, experience and progression" },
  { label: "Writing the assessment", detail: "Score, rationale and questions" },
];

export const FEEDBACK_DOWN_REASONS = [
  "Missed a key skill",
  "Got seniority wrong",
  "Missed a red flag",
  "Score too high",
  "Score too low",
  "Other",
];

export const EMAIL_PURPOSES = [
  { value: "invite_to_interview", label: "Invite to interview", audience: "candidate" },
  { value: "client_shortlist_update", label: "Client shortlist update", audience: "client" },
  { value: "rejection", label: "Rejection", audience: "candidate" },
  { value: "chase_feedback", label: "Chase client feedback", audience: "client" },
];

const CV_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const CV_EXTENSIONS = [".pdf", ".docx"];
export const CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const JOB_ACCEPT = `${CV_ACCEPT},.txt,text/plain`;

// Below this a PDF/DOCX usually has little extractable text (a scan, or a
// one-line CV) - worth a heads-up before spending an analysis on it.
const THIN_CV_BYTES = 15 * 1024;

export function isThinCv(file) {
  return !!file && file.size > 0 && file.size < THIN_CV_BYTES;
}

function hasExtension(file, extensions) {
  const name = (file?.name || "").toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
}

export function isAcceptedCvFile(file) {
  if (!file) return false;
  return CV_TYPES.includes(file.type) || hasExtension(file, CV_EXTENSIONS);
}

export function isAcceptedJobFile(file) {
  if (!file) return false;
  return [...CV_TYPES, "text/plain"].includes(file.type) || hasExtension(file, [...CV_EXTENSIONS, ".txt"]);
}

export function isTextFile(file) {
  return file?.type === "text/plain" || hasExtension(file, [".txt"]);
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Returns an error message for a CV that can't be analysed, or null.
export function cvFileProblem(file) {
  if (!file) return null;
  if (!isAcceptedCvFile(file)) return "Upload the CV as a PDF or Word (.docx) file.";
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)} - the limit is 10 MB.`;
  return null;
}

export function jobFileProblem(file) {
  if (!file) return null;
  if (!isAcceptedJobFile(file)) return "Upload the job spec as a PDF, Word (.docx) or .txt file.";
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)} - the limit is 10 MB.`;
  return null;
}

// localStorage, tolerant of private mode / blocked storage.
export function ls(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value !== null ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked - nothing to do.
  }
}

// The same file name analysed before on this browser - usually a re-upload
// rather than a new candidate.
//
// Kept in this browser only, for 30 days at most (file names are often the
// candidate's name) and cleared on log out (lib/clear-local-data.js).
const HISTORY_MAX_AGE_MS = 30 * 86400000;

function recentHistory() {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  return ls("analysisHistory", []).filter((h) => h?.timestamp && new Date(h.timestamp).getTime() >= cutoff);
}

export function findPreviousAnalysis(file) {
  if (!file) return null;
  return recentHistory().find((h) => h.cvName === file.name) || null;
}

export function recordAnalysis(entry) {
  const history = recentHistory();
  history.unshift(entry);
  lsSet("analysisHistory", history.slice(0, 50));
}

// Text for the role box when a saved job has no original description.
export function savedJobText(job) {
  if (!job) return "";
  return (
    job.job_text ||
    [
      job.title,
      job.company ? `Client: ${job.company}` : null,
      job.requiredSkills?.length ? `Required skills: ${job.requiredSkills.join(", ")}` : null,
      job.preferredSkills?.length ? `Preferred skills: ${job.preferredSkills.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export function scoreTone(score) {
  if (score == null) return { fg: "var(--ink-faint)", bg: "var(--mist)", label: "No score" };
  if (score >= STRONG_MATCH_MIN) return { fg: "var(--score-strong)", bg: "var(--mint)", label: "Strong match" };
  if (score >= REVIEW_MIN) return { fg: "var(--score-mid)", bg: "#fdf6e9", label: "Worth a look" };
  return { fg: "var(--score-low)", bg: "#fbefed", label: "Weak match" };
}

// Role templates, job types and the role builder live in ./roles.js.
