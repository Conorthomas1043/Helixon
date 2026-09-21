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

function isValidJudgment(j) {
  return (
    j &&
    typeof j === "object" &&
    typeof j.industry_relevance?.score !== "undefined" &&
    typeof j.career_trajectory?.score !== "undefined" &&
    typeof j.achievement_quality?.score !== "undefined"
  );
}

function heuristicFallback(candidate, job, reason) {
  const industryScore = scoreIndustry(candidate, job);
  const progression = analyseProgression(candidate.positions || []);

  return {
    industry_relevance: {
      score: industryScore,
      rationale: `Claude judgement unavailable (${reason}) - fell back to exact industry-name matching.`,
    },
    career_trajectory: {
      score: progression.score,
      label: progression.progression,
      rationale: `Claude judgement unavailable (${reason}) - fell back to a title-keyword heuristic.`,
    },
    achievement_quality: {
      score: 0,
      rationale: `Claude judgement unavailable (${reason}).`,
    },
    method: "heuristic_fallback",
    samples: 0,
  };
}

export async function judgeFit(candidate, job, cvText) {
  const prompt = fitJudgmentPrompt({ candidate, job, cvText });

  let settled;
  try {
    settled = await Promise.allSettled(
      Array.from({ length: SAMPLES }, () => askClaude(prompt, { temperature: JUDGMENT_TEMPERATURE }))
    );
  } catch {
    return heuristicFallback(candidate, job, "request failed");
  }

  const valid = settled
    .filter((s) => s.status === "fulfilled" && isValidJudgment(s.value))
    .map((s) => s.value);

  if (valid.length === 0) {
    return heuristicFallback(candidate, job, "no valid response");
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
