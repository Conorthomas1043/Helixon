// Judges the parts of a match that are genuinely a matter of judgement, not
// a checklist - industry relevance, career trajectory, achievement quality
// - by asking Claude directly, instead of the keyword/regex heuristics this
// replaces:
//   - industryEngine.js scored 100 only on an exact industry-name string
//     match, 50 for everything else (no match, no data, adjacent domain -
//     all identical).
//   - progressionEngine.js matched job titles against a 10-word English
//     ladder ("intern".."director"); any title outside that list (Analyst,
//     Consultant, Specialist, Coordinator, VP, Partner...) silently scored
//     as level 0 (intern-equivalent).
//   - achievementEngine.js scored achievement quality by counting lines
//     that contained a number or one of 10 impact verbs.
// Those heuristics are kept, not deleted - they're the fallback here if
// Claude is unavailable or every sample fails to parse, so a Claude outage
// degrades scoring rather than breaking it.
//
// One sample by default, anchored by explicit score bands in the prompt
// (fitJudgmentPrompt.js). This used to take the median of 3 samples to
// smooth out run-to-run variance; the anchors do most of that job for a
// third of the calls, which matters most in bulk runs where 3 judge calls
// per CV were the bulk of the Anthropic rate-limit usage and the main
// source of 429 retries. Set CV_FIT_JUDGE_SAMPLES (1-5) to sample more if
// your own evaluation shows the extra consistency is worth it; with more
// than one sample the median score per component is used, as before.
import askClaude from "../anthropic/askClaude.js";
import { JUDGMENT_EFFORT } from "../config.js";
import { fitJudgmentPrompt } from "../prompts/fitJudgmentPrompt.js";
import { scoreIndustry } from "./industryEngine.js";
import { analyseProgression } from "./progressionEngine.js";

const SAMPLES = Math.min(5, Math.max(1, Math.round(Number(process.env.CV_FIT_JUDGE_SAMPLES) || 1)));
const VALID_LABELS = new Set(["Positive", "Static", "Regression", "Unknown"]);

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

// typeof check first, not just Number.isFinite(Number(v)) - Number(null) is
// 0 and Number.isFinite(0) is true, which would wrongly accept a null score.
// Only a genuine, finite number counts as valid; a stray string/null/bool
// score from a malformed Claude response is rejected outright rather than
// silently corrupting the median below (mixed-type array sort is undefined
// behaviour in JS - confirmed this produced a wrong-but-plausible-looking
// median instead of an obvious failure, which is the worse outcome).
function isValidScore(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidJudgment(j) {
  return (
    j &&
    typeof j === "object" &&
    isValidScore(j.industry_relevance?.score) &&
    isValidScore(j.career_trajectory?.score) &&
    isValidScore(j.achievement_quality?.score)
  );
}

// Rationale text here is user-facing (surfaced directly in
// score_rationale.culture on the candidate profile), so it reads like a
// normal, honest product explanation rather than an engineering log line -
// no "Claude", no internal reason codes.
function heuristicFallback(candidate, job) {
  const industryScore = scoreIndustry(candidate, job);
  const progression = analyseProgression(candidate.positions || []);

  return {
    industry_relevance: {
      score: industryScore,
      rationale: "Industry relevance estimated by name match only - AI assessment wasn't available for this analysis.",
    },
    career_trajectory: {
      score: progression.score,
      label: progression.progression,
      rationale: "Career trajectory estimated from job titles only - AI assessment wasn't available for this analysis.",
    },
    achievement_quality: {
      score: 0,
      rationale: "Achievement quality couldn't be assessed for this analysis.",
    },
    relevant_experience: null,
    method: "heuristic_fallback",
    samples: 0,
  };
}

export async function judgeFit(candidate, job, cvText) {
  let settled;
  try {
    const prompt = fitJudgmentPrompt({ candidate, job, cvText });
    settled = await Promise.allSettled(
      Array.from({ length: SAMPLES }, () => askClaude(prompt, { effort: JUDGMENT_EFFORT }))
    );
  } catch (err) {
    // Covers prompt-building failures too (not just the Claude calls) -
    // previously fitJudgmentPrompt() ran outside this try/catch, so a
    // malformed candidate/job object could throw uncaught here and crash
    // the whole analysis instead of degrading to the fallback below.
    console.error("[fitJudgeEngine] judgeFit failed before/during sampling:", err.message);
    return heuristicFallback(candidate, job);
  }

  const valid = settled
    .filter((s) => s.status === "fulfilled" && isValidJudgment(s.value))
    .map((s) => s.value);

  if (valid.length === 0) {
    return heuristicFallback(candidate, job);
  }

  // Rationale text comes from the sample whose scores sit closest to the
  // medians, so the explanation shown argues for the score shown. (It used
  // to always be sample 0, which could explain a 40 next to a displayed 75.)
  const medians = {
    industry_relevance: clamp(median(valid.map((v) => v.industry_relevance.score))),
    career_trajectory: clamp(median(valid.map((v) => v.career_trajectory.score))),
    achievement_quality: clamp(median(valid.map((v) => v.achievement_quality.score))),
  };
  const closest = (key) =>
    valid.reduce((best, v) =>
      Math.abs(v[key].score - medians[key]) < Math.abs(best[key].score - medians[key]) ? v : best
    );

  const careerSample = closest("career_trajectory");
  const label = careerSample.career_trajectory.label;

  const relevantYears = valid
    .map((v) => v.relevant_experience?.years)
    .filter(isValidScore)
    .map((years) => Math.max(0, years));

  return {
    industry_relevance: {
      score: medians.industry_relevance,
      rationale: String(closest("industry_relevance").industry_relevance.rationale || "").slice(0, 500),
    },
    career_trajectory: {
      score: medians.career_trajectory,
      label: VALID_LABELS.has(label) ? label : "Unknown",
      rationale: String(careerSample.career_trajectory.rationale || "").slice(0, 500),
    },
    achievement_quality: {
      score: medians.achievement_quality,
      rationale: String(closest("achievement_quality").achievement_quality.rationale || "").slice(0, 500),
    },
    // Years of experience relevant to this role, as opposed to total career
    // length - null when no sample returned a usable number, in which case
    // scoreCandidate falls back to total years.
    relevant_experience: relevantYears.length
      ? {
          years: Math.round(median(relevantYears) * 10) / 10,
          rationale: String(valid[0].relevant_experience?.rationale || "").slice(0, 500),
        }
      : null,
    method: "llm_judged",
    samples: valid.length,
  };
}
