import { SCORE_WEIGHTS } from "../config.js";

import { semanticMatch } from "./semanticMatcher.js";
import { embedSkills, findSemanticMatch } from "./embeddingMatcher.js";

import { collectEvidence, unsupportedSkills } from "./evidenceEngine.js";

import { extractAchievements } from "./achievementEngine.js";

import { buildBreakdown } from "./explainabilityEngine.js";

import { calculateConfidence } from "./confidenceEngine.js";

import { hiringRisk } from "./riskEngine.js";

import { judgeFit } from "./fitJudgeEngine.js";

import interviewQuestions from "./interviewQuestions.js";

import { analyseEmploymentGaps } from "./gapEngine.js";

import { applyKnockouts } from "./knockoutEngine.js";

import { analyseCertifications } from "./certificationEngine.js";

import validateScore from "../validators/validateScore.js";


// Match a list of job-required skill names against what the candidate has.
// Tries the static taxonomy/whole-word matcher first (free, deterministic,
// covers the common case); anything it misses falls back to real embedding
// similarity (embeddings map is pre-computed by the caller, covering only
// the skills that actually need it - see scoreCandidate below).
function matchSkillList(skillList, candidateSkills, embeddings) {

    const matched = [];
    const missing = [];
    const semanticMatches = [];

    for (const skill of skillList) {

        const result = semanticMatch(skill, candidateSkills);

        if (result.matched) {
            matched.push(skill);
            continue;
        }

        const viaEmbedding = embeddings ? findSemanticMatch(skill, candidateSkills, embeddings) : null;

        if (viaEmbedding) {
            matched.push(skill);
            semanticMatches.push({ skill, via: viaEmbedding.matched, similarity: viaEmbedding.score });
        } else {
            missing.push(skill);
        }
    }

    return { matched, missing, semanticMatches };
}


export default async function scoreCandidate(

    candidate = {},

    job = {},

    rawCV = ""

) {


    // protect against non-string CV input
    if (typeof rawCV !== "string") {

        if (rawCV?.text) {
            rawCV = rawCV.text;
        } else {
            rawCV = JSON.stringify(rawCV || "");
        }
    }


    const requiredSkills = job.required_skills || [];
    const preferredSkills = job.preferred_skills || [];
    const candidateSkills = candidate.skills || [];


    // Kicked off now, awaited later (alongside the embeddings fetch below) -
    // judgeFit makes its own (up to 3, parallel) Claude calls, so starting
    // it here means that latency overlaps with the skill-matching work
    // instead of adding on top of it.
    const judgmentPromise = judgeFit(candidate, job, rawCV);

    // Only pay for embeddings on the skills the free taxonomy pass actually
    // missed - most jobs resolve entirely through semanticMatch and never
    // trigger an API call at all.
    const taxonomyMisses = [...requiredSkills, ...preferredSkills].filter(
        (skill) => !semanticMatch(skill, candidateSkills).matched
    );
    const embeddings = taxonomyMisses.length
        ? await embedSkills([...taxonomyMisses, ...candidateSkills])
        : new Map();

    const { matched: matchedRequired, missing: missingRequired, semanticMatches: semanticRequired } =
        matchSkillList(requiredSkills, candidateSkills, embeddings);

    const { matched: matchedPreferred, missing: missingPreferred, semanticMatches: semanticPreferred } =
        matchSkillList(preferredSkills, candidateSkills, embeddings);

    const matchedSkills = [...new Set([...matchedRequired, ...matchedPreferred])];
    const semanticMatches = [...semanticRequired, ...semanticPreferred];

    // Skills the candidate listed that weren't asked for at all. Note: a
    // skill matched only via the semantic taxonomy (e.g. candidate has
    // "Node.js", job asked for "JavaScript") is credited under its
    // required/preferred name above and will also still show up here
    // under its own literal name - a known, minor double-count rather
    // than a hidden one.
    const askedFor = new Set(
        [...requiredSkills, ...preferredSkills].map((s) => s.toLowerCase())
    );
    const otherSkills = candidateSkills.filter(
        (s) => !askedFor.has(String(s).toLowerCase())
    );


    const evidence = collectEvidence(rawCV, matchedSkills);
    const unsupported = unsupportedSkills(evidence);


    // --- component scores, weighted per SCORE_WEIGHTS (out of 100) ---

    const requiredScore = Math.round(
        (matchedRequired.length / Math.max(1, requiredSkills.length)) * SCORE_WEIGHTS.required
    );

    const preferredScore = preferredSkills.length
        ? Math.round((matchedPreferred.length / preferredSkills.length) * SCORE_WEIGHTS.preferred)
        : SCORE_WEIGHTS.preferred; // nothing preferred was asked for - don't penalise for it

    const minYears = Number(job.min_years_experience) || 0;
    const yearsExperience = Number(candidate.years_experience) || 0;

    const experienceScore = minYears > 0
        ? Math.round(Math.min(1, yearsExperience / minYears) * SCORE_WEIGHTS.experience)
        // no minimum stated - use 5 years as a reasonable full-credit baseline
        : Math.round(Math.min(1, yearsExperience / 5) * SCORE_WEIGHTS.experience);

    // Industry relevance, career trajectory and achievement quality are
    // judgement calls, not checklist items - see fitJudgeEngine.js for why
    // these replaced industryEngine.js/progressionEngine.js's keyword
    // heuristics (exact-string industry match; a 10-word English title
    // ladder that scored anything else, e.g. "Consultant"/"VP"/"Partner",
    // as level 0). Falls back to those same heuristics if Claude judgement
    // is unavailable - see judgeFit's heuristicFallback.
    const judgment = await judgmentPromise;

    const progression = { progression: judgment.career_trajectory.label, score: judgment.career_trajectory.score };
    const careerScore = Math.round((judgment.career_trajectory.score / 100) * SCORE_WEIGHTS.career);

    const industryRaw = judgment.industry_relevance.score; // 0-100
    const industryScore = Math.round((industryRaw / 100) * SCORE_WEIGHTS.industry);

    const breakdown = buildBreakdown({
        required: requiredScore,
        preferred: preferredScore,
        experience: experienceScore,
        career: careerScore,
        industry: industryScore,
    });

    const knockout = applyKnockouts(candidate, job, breakdown.Total);


    // --- supporting analysis ---

    // extractAchievements still finds the actual CV lines to quote in
    // standoutFactors below (the LLM judgement doesn't return line-level
    // text) - only the numeric quality score comes from judgeFit now,
    // replacing achievementEngine.js's "count lines with a number or an
    // impact verb" heuristic.
    const achievements = extractAchievements(rawCV);
    const achievementsScoreValue = judgment.achievement_quality.score;

    const gaps = analyseEmploymentGaps(candidate.positions || []);
    const certs = analyseCertifications(candidate.certifications || []);

    const confidenceResult = calculateConfidence({
        evidence,
        cvIssues: candidate.cv_quality_issues || [],
        matched: matchedRequired.length,
        required: requiredSkills.length,
    });

    const risk = hiringRisk({
        confidence: confidenceResult.confidence,
        unsupportedSkills: unsupported.length,
        expiredCerts: certs.expired.length,
    });

    const confidenceLabel =
        confidenceResult.confidence >= 80 ? "High" :
        confidenceResult.confidence >= 50 ? "Medium" : "Low";


    // --- narrative fields, built deterministically from the numbers
    // above (scoreCandidate makes no further Claude calls) ---

    const strengths = [];

    for (const skill of matchedRequired) {
        const skillEvidence = evidence.find((e) => e.skill === skill);
        if (skillEvidence?.supported) {
            strengths.push(`Demonstrated experience with ${skill}, supported by CV evidence`);
        }
    }
    // Gated on the judged achievement_quality score, not just "the regex
    // found a line with a number in it" - achievementsScoreValue now comes
    // from Claude's holistic judgement (see fitJudgeEngine.js), and
    // without this gate a candidate could get "achievement quality: 20"
    // right next to "CV includes quantified, impact-driven achievements",
    // which contradicts itself. 50 is the same "at least middling"
    // threshold used for confidenceLabel above.
    if (achievementsScoreValue >= 50 && achievements.some((a) => a.quantified && a.impact)) {
        strengths.push("CV includes quantified, impact-driven achievements");
    }
    if (progression.progression === "Positive") {
        strengths.push("Clear upward career progression");
    }
    if (matchedPreferred.length) {
        strengths.push(`Also brings ${matchedPreferred.length} preferred skill(s): ${matchedPreferred.join(", ")}`);
    }


    const weaknesses = [];

    if (missingRequired.length) {
        weaknesses.push(`Missing ${missingRequired.length} required skill(s): ${missingRequired.join(", ")}`);
    }
    if (unsupported.length) {
        weaknesses.push(`${unsupported.length} matched skill(s) have no direct evidence in the CV text`);
    }
    if (progression.progression === "Regression") {
        weaknesses.push("Recent role titles suggest a step down in seniority");
    }
    // Employment gaps deliberately aren't scored as a weakness or red flag:
    // a CV states that a gap exists but essentially never states why, and
    // gaps correlate heavily with protected characteristics (parental/
    // family leave, disability, long-term illness, caregiving). Treating
    // "has a gap" as inherently negative by default penalises exactly the
    // candidates equality law protects, based on a fact the system can't
    // actually interpret. The gap itself is still returned (see
    // employment_gaps below) as neutral information for a recruiter's own
    // judgement, not as something the system has already decided is bad.


    const redFlags = [];

    for (const rule of knockout.failed) {
        redFlags.push(`Does not meet required criterion: ${rule.field} = ${rule.value}`);
    }
    // Unverifiable requirements (right to work, security clearance, etc. -
    // see knockoutEngine.js) are deliberately NOT a red flag: that framing
    // would still read as "something's wrong with this candidate" for a
    // fact their CV was simply never going to state either way. They're
    // surfaced neutrally instead, in requirementsMet below.
    if (risk.level === "High") {
        redFlags.push("Overall hiring risk assessed as High");
    }
    if (certs.expired.length) {
        redFlags.push(`${certs.expired.length} certification(s) have expired`);
    }


    const standoutFactors = [];

    // Same gate as strengths above - only quote achievement lines as
    // "standout" when Claude's own judgement agrees they're actually
    // strong, so this can't show a quoted "standout achievement" next to
    // a low achievement_quality score.
    if (achievementsScoreValue >= 50) {
        for (const a of achievements) {
            if (a.quantified && a.impact) {
                standoutFactors.push(a.text);
            }
        }
    }
    if (industryRaw >= 80) {
        standoutFactors.push("Direct industry experience matches this role");
    }
    if (progression.progression === "Positive") {
        standoutFactors.push("Track record of promotion / increasing responsibility");
    }


    // Three real states, not two: "met" (verified from the CV), "not met"
    // (verified from the CV and it fails) and "unverified" (the CV has no
    // way to tell us - e.g. right to work, security clearance). Previously
    // this only tracked failed vs. not-failed, which reported every
    // unverifiable requirement as "met: true" - actively misleading, since
    // nothing had actually confirmed it.
    const requirementsMet = (job.knockout_requirements || []).map((rule) => {
        const status = knockout.failed.includes(rule)
            ? "not_met"
            : knockout.unverified.includes(rule)
                ? "unverified"
                : "met";

        return {
            requirement: `${rule.field}: ${rule.value}`,
            status,
            met: status === "met", // kept for anything still reading the boolean shape
        };
    });


    const recommendation =
        knockout.failed.length > 0 ? "Not suitable" :
        knockout.score >= 80 ? "Strong match" :
        knockout.score >= 55 ? "Worth reviewing" :
        "Not suitable";


    const summary =
        `${candidate.name || "This candidate"} matches ${matchedRequired.length}/${requiredSkills.length || 0} required skill(s)` +
        (preferredSkills.length ? ` and ${matchedPreferred.length}/${preferredSkills.length} preferred skill(s)` : "") +
        `. Career progression is ${(progression.progression || "unknown").toLowerCase()}, hiring risk is ${risk.level.toLowerCase()}.`;


    const scoreRationale = {
        skills: `${matchedRequired.length}/${requiredSkills.length || 0} required and ${matchedPreferred.length}/${preferredSkills.length || 0} preferred skills matched`,
        experience: minYears
            ? `${yearsExperience} years of experience vs. ${minYears} required`
            : `${yearsExperience} years of experience`,
        culture: judgment.industry_relevance.rationale,
        capped: knockout.failed.length > 0,
        cap_reason: knockout.failed.length
            ? `Score capped after failing ${knockout.failed.length} required criterion/criteria`
            : null,
    };


    const questions = interviewQuestions({
        missing: missingRequired,
        risk,
    });


    const result = {

        // kept for anything still reading the pre-fix shape
        // (lib/cv-analysis/pipeline/orchestrator.js, reporting/recruiterReport.js)
        candidate,
        overall: knockout.score,

        match_score: knockout.score,
        skill_score: Math.round(((requiredScore + preferredScore) / (SCORE_WEIGHTS.required + SCORE_WEIGHTS.preferred)) * 100),
        experience_score: Math.round(((experienceScore + careerScore) / (SCORE_WEIGHTS.experience + SCORE_WEIGHTS.career)) * 100),
        culture_score: industryRaw,

        recommendation,
        summary,
        confidence: confidenceLabel,
        score_rationale: scoreRationale,

        matched_skills: matchedSkills,
        missing_skills: missingRequired,
        missing_required: missingRequired,
        missing_preferred: missingPreferred,
        other_skills: otherSkills,
        // Skills credited only via embedding similarity, not the static
        // taxonomy or a literal name match - surfaced explicitly (skill,
        // the candidate's actual wording, similarity score) so a recruiter
        // can see and audit why something matched rather than trusting an
        // invisible "AI decided" match.
        semantic_matches: semanticMatches,

        strengths,
        weaknesses,
        red_flags: redFlags,
        standout_factors: standoutFactors,
        interview_questions: questions,
        requirements_met: requirementsMet,

        evidence,
        breakdown,
        achievement_score: achievementsScoreValue,
        career_progression: progression,
        employment_gaps: gaps,
        // Full judgement with rationales, including whether it came from
        // Claude or the heuristic fallback (judgment.method) - so a drop
        // to heuristic_fallback is visible to whoever's looking, not silent.
        fit_judgment: judgment,
        risk,

    };

    return validateScore(result);
}