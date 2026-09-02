import { SCORE_WEIGHTS } from "../config.js";

import { semanticMatch } from "./semanticMatcher.js";

import { collectEvidence, unsupportedSkills } from "./evidenceEngine.js";

import { achievementScore, extractAchievements } from "./achievementEngine.js";

import { analyseProgression } from "./progressionEngine.js";

import { buildBreakdown } from "./explainabilityEngine.js";

import { calculateConfidence } from "./confidenceEngine.js";

import { hiringRisk } from "./riskEngine.js";

import { scoreIndustry } from "./industryEngine.js";

import interviewQuestions from "./interviewQuestions.js";

import { analyseEmploymentGaps } from "./gapEngine.js";

import { applyKnockouts } from "./knockoutEngine.js";

import { analyseCertifications } from "./certificationEngine.js";

import validateScore from "../validators/validateScore.js";


// Match a list of job-required skill names against what the candidate has,
// using the same taxonomy-aware matcher for both required and preferred.
function matchSkillList(skillList, candidateSkills) {

    const matched = [];
    const missing = [];

    for (const skill of skillList) {

        const result = semanticMatch(skill, candidateSkills);

        if (result.matched) {
            matched.push(skill);
        } else {
            missing.push(skill);
        }
    }

    return { matched, missing };
}


export default function scoreCandidate(

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


    const { matched: matchedRequired, missing: missingRequired } =
        matchSkillList(requiredSkills, candidateSkills);

    const { matched: matchedPreferred, missing: missingPreferred } =
        matchSkillList(preferredSkills, candidateSkills);

    const matchedSkills = [...new Set([...matchedRequired, ...matchedPreferred])];

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

    const progression = analyseProgression(candidate.positions || []);
    const careerScore = Math.round(((progression.score || 0) / 100) * SCORE_WEIGHTS.career);

    const industryRaw = scoreIndustry(candidate, job); // 0-100
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

    const achievements = extractAchievements(rawCV);
    const achievementsScoreValue = achievementScore(achievements);

    const gaps = analyseEmploymentGaps(candidate.positions || []);
    const certs = analyseCertifications(candidate.certifications || []);

    const confidenceResult = calculateConfidence({
        evidence,
        cvIssues: candidate.cv_quality_issues || [],
        matched: matchedRequired.length,
        required: requiredSkills.length,
    });

    const risk = hiringRisk({
        gaps: gaps.gaps.length,
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
    if (achievements.some((a) => a.quantified && a.impact)) {
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
    if (gaps.largest > 1) {
        weaknesses.push(`Employment gap of ${gaps.largest} year(s) on the CV`);
    }


    const redFlags = [];

    for (const rule of knockout.failed) {
        redFlags.push(`Does not meet required criterion: ${rule.field} = ${rule.value}`);
    }
    if (risk.level === "High") {
        redFlags.push("Overall hiring risk assessed as High");
    }
    if (certs.expired.length) {
        redFlags.push(`${certs.expired.length} certification(s) have expired`);
    }
    if (gaps.gaps.some((g) => g.recent && g.years > 1)) {
        redFlags.push("Most recent employment gap is unexplained");
    }


    const standoutFactors = [];

    for (const a of achievements) {
        if (a.quantified && a.impact) {
            standoutFactors.push(a.text);
        }
    }
    if (industryRaw === 100) {
        standoutFactors.push("Direct industry experience matches this role");
    }
    if (progression.progression === "Positive") {
        standoutFactors.push("Track record of promotion / increasing responsibility");
    }


    const requirementsMet = (job.knockout_requirements || []).map((rule) => ({
        requirement: `${rule.field}: ${rule.value}`,
        met: !knockout.failed.includes(rule),
    }));


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
        culture: industryRaw === 100
            ? "Candidate has direct experience in this industry"
            : "No confirmed industry-specific experience",
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
        risk,

    };

    return validateScore(result);
}