// Whether a CV reads as largely written with an AI tool, as the CV reader
// judged it (candidates.extracted.ai_writing - see
// lib/cv-analysis/prompts/candidateExtractionPrompt.js).
//
// It's a prompt to check, never a verdict: plenty of good candidates use AI
// to polish a CV, and detection is unreliable. So it is shown only for clear
// cases (judged "high" with at least two named signs), in amber, and it never
// touches the score - nothing in lib/cv-analysis/scoring reads it.

export const AI_WRITING_MESSAGE =
  "This CV reads as if much of it was written with AI. That's not a reason to turn anyone down - check the specifics at interview.";

const LIKELIHOODS = new Set(["low", "medium", "high"]);
const MAX_SIGNALS = 4;

/**
 * The CV reader's output, tidied: an unknown likelihood counts as "low".
 * @param {unknown} raw
 * @returns {{ likelihood: "low" | "medium" | "high", signals: string[] }}
 */
export function normaliseAiWriting(raw) {
  const value = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const likelihood = typeof value.likelihood === "string" ? value.likelihood.trim().toLowerCase() : "";
  const signals = (Array.isArray(value.signals) ? value.signals : [])
    .map((s) => (typeof s === "string" ? s.trim().slice(0, 200) : ""))
    .filter(Boolean)
    .slice(0, MAX_SIGNALS);
  return {
    likelihood: /** @type {"low" | "medium" | "high"} */ (LIKELIHOODS.has(likelihood) ? likelihood : "low"),
    signals,
  };
}

/**
 * The amber notice for a report, or null when there's nothing clear to say.
 * @param {{ ai_writing?: unknown } | null | undefined} extracted candidates.extracted
 * @returns {{ message: string, signals: string[] } | null}
 */
export function aiWritingNotice(extracted) {
  const { likelihood, signals } = normaliseAiWriting(extracted?.ai_writing);
  if (likelihood !== "high" || signals.length < 2) return null;
  return { message: AI_WRITING_MESSAGE, signals };
}
