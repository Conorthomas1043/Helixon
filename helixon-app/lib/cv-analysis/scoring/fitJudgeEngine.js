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
// If Claude is unavailable or every sample fails to parse, the three score
// as a neutral 50 (see heuristicFallback), so an outage degrades scoring
// rather than breaking it, and the result says so.
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
// When Claude's judgement is unavailable, the three judged components score
// a neutral 50 ("unknown") rather than the old keyword heuristics: an
// exact industry-name match (100 or 50) and a 10-title seniority ladder
// were so much cruder than the judgement that candidates scored during an
// outage weren't comparable with the rest of the same job. The result is
// marked method "heuristic_fallback" and scoreCandidate adds a warning
// telling the recruiter to re-screen.
function heuristicFallback() {
  return {
    industry_relevance: {
      score: 50,
      rationale: "Industry relevance couldn't be assessed for this analysis, so it counts as neutral. Re-screen for a full assessment.",
    },
    career_trajectory: {
      score: 50,
      label: "Unknown",
      rationale: "Career trajectory couldn't be assessed for this analysis, so it counts as neutral. Re-screen for a full assessment.",
    },
    achievement_quality: {
      score: 50,
      rationale: "Achievement quality couldn't be assessed for this analysis, so it counts as neutral.",
    },
    relevant_experience: null,
    requirements_check: [],
    method: "heuristic_fallback",
    samples: 0,
  };
}

// Letters and digits only, single-spaced - so a quote still verifies
// across line breaks, bullet characters and punctuation differences.
function flatten(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const MIN_QUOTE_CHARS = 12;

// Requirements the judgement says the CV demonstrates, kept only when the
// quoted evidence really appears in the CV - so a requirement can't be
// credited on a paraphrase or an invented line. With several samples a
// skill needs a verified "yes" from a majority of them.
function verifiedRequirements(samples, unmatchedSkills, cvText) {
  if (!unmatchedSkills.length) return [];

  const cv = flatten(cvText);
  const wanted = new Map(unmatchedSkills.map((skill) => [skill.toLowerCase(), skill]));
  const votes = new Map();

  for (const sample of samples) {
    const seen = new Set();
    for (const check of Array.isArray(sample.requirements_check) ? sample.requirements_check : []) {
      const skill = wanted.get(String(check?.skill || "").trim().toLowerCase());
      if (!skill || seen.has(skill) || check.demonstrated !== true) continue;

      const quote = flatten(check.evidence);
      if (quote.length < MIN_QUOTE_CHARS || !cv.includes(quote)) continue;

      seen.add(skill);
      const entry = votes.get(skill) || { count: 0, evidence: String(check.evidence).trim().slice(0, 300) };
      entry.count += 1;
      votes.set(skill, entry);
    }
  }

  return [...votes]
    .filter(([, v]) => v.count > samples.length / 2)
    .map(([skill, v]) => ({ skill, evidence: v.evidence }));
}

export async function judgeFit(candidate, job, cvText, { unmatchedSkills = [] } = {}) {
  let settled;
  try {
    const prompt = fitJudgmentPrompt({ candidate, job, cvText, unmatchedSkills });
    settled = await Promise.allSettled(
      Array.from({ length: SAMPLES }, () => askClaude(prompt, { effort: JUDGMENT_EFFORT }))
    );
  } catch (err) {
    // Covers prompt-building failures too (not just the Claude calls) -
    // previously fitJudgmentPrompt() ran outside this try/catch, so a
    // malformed candidate/job object could throw uncaught here and crash
    // the whole analysis instead of degrading to the fallback below.
    console.error("[fitJudgeEngine] judgeFit failed before/during sampling:", err.message);
    return heuristicFallback();
  }

  const valid = settled
    .filter((s) => s.status === "fulfilled" && isValidJudgment(s.value))
    .map((s) => s.value);

  if (valid.length === 0) {
    return heuristicFallback();
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
    // Unmatched requirements confirmed from the CV, each with its verified
    // quote - see verifiedRequirements.
    requirements_check: verifiedRequirements(valid, unmatchedSkills, cvText),
    method: "llm_judged",
    samples: valid.length,
    // How far apart the samples were (max - min, 0-100) for each judged
    // score - a direct measure of run-to-run variance. Only when more than
    // one sample ran (CV_FIT_JUDGE_SAMPLES > 1).
    spread: valid.length > 1
      ? Object.fromEntries(["industry_relevance", "career_trajectory", "achievement_quality"].map((key) => {
          const values = valid.map((v) => clamp(v[key].score));
          return [key, Math.max(...values) - Math.min(...values)];
        }))
      : null,
  };
}
