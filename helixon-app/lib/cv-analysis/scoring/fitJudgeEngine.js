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
// Samples 3 times at a non-zero temperature and takes the median score per
// component: self-consistency, a documented technique for reducing the
// variance of a single LLM judgement by averaging out sample noise. This
// is a deliberate trade-off against the extraction calls' temperature 0
// (chosen there specifically for byte-for-byte reproducibility) - it means
// re-analysing the exact same candidate/job pair can produce a slightly
// different industry/career/achievement score run to run, in exchange for
// each individual run being more reliable. It also means 3x the Claude
// calls of a single-sample judgement, run in parallel so latency stays
// close to one call, not three.
import askClaude from "../anthropic/askClaude.js";
import { fitJudgmentPrompt } from "../prompts/fitJudgmentPrompt.js";
import { scoreIndustry } from "./industryEngine.js";
import { analyseProgression } from "./progressionEngine.js";

const SAMPLES = 3;
const JUDGMENT_TEMPERATURE = 0.4;
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
    method: "heuristic_fallback",
    samples: 0,
  };
}

export async function judgeFit(candidate, job, cvText) {
  let settled;
  try {
    const prompt = fitJudgmentPrompt({ candidate, job, cvText });
    settled = await Promise.allSettled(
      Array.from({ length: SAMPLES }, () => askClaude(prompt, { temperature: JUDGMENT_TEMPERATURE }))
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

  const label = valid[0].career_trajectory.label;

  return {
    industry_relevance: {
      score: clamp(median(valid.map((v) => v.industry_relevance.score))),
      rationale: String(valid[0].industry_relevance.rationale || "").slice(0, 500),
    },
    career_trajectory: {
      score: clamp(median(valid.map((v) => v.career_trajectory.score))),
      label: VALID_LABELS.has(label) ? label : "Unknown",
      rationale: String(valid[0].career_trajectory.rationale || "").slice(0, 500),
    },
    achievement_quality: {
      score: clamp(median(valid.map((v) => v.achievement_quality.score))),
      rationale: String(valid[0].achievement_quality.rationale || "").slice(0, 500),
    },
    method: "llm_judged",
    samples: valid.length,
  };
}
