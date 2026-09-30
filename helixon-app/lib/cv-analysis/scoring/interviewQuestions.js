// Suggested interview questions, built from the skills the analysis found
// missing or only listed. Every skill name here comes out of the job
// extraction - i.e. from a job spec someone pasted or uploaded - so it's
// treated as untrusted text: cleaned, length-checked, deduplicated, capped,
// and never turned into a question about a protected characteristic.
//
// Deliberately never asks about employment gaps - see riskEngine.js and
// scoreCandidate.js for why gaps aren't treated as a negative signal. (It
// used to add "Can you explain any employment gaps?" whenever risk was
// High, even though risk is computed without looking at gaps at all.)

import { PROTECTED_ATTRIBUTE_PATTERNS } from "../config.js";
import { cleanLine } from "../../sanitize.js";
import { detectPromptInjection } from "../../prompt-safety.js";

export const MAX_MISSING_QUESTIONS = 5;
export const MAX_UNSUPPORTED_QUESTIONS = 3;
export const MAX_QUESTIONS = MAX_MISSING_QUESTIONS + MAX_UNSUPPORTED_QUESTIONS;

// A real skill name is short. Anything longer is a sentence from the job
// spec that extraction passed through, and makes no sense as "your
// experience with <...>".
const MAX_SKILL_CHARS = 80;

// The skill as it can safely appear in a question, or "" to leave it out.
export function questionSkill(value) {
    const skill = cleanLine(typeof value === "string" ? value : "", 500)
        // Quotes/backticks would read as if the question were quoting the CV.
        .replace(/["`“”]/g, "")
        .replace(/[\s.,;:!?-]+$/, "")
        .trim();

    if (!skill || skill.length > MAX_SKILL_CHARS) return "";
    // Same code-level guard validateJob.js applies to knockout rules: a job
    // spec must not get Helixon suggesting a recruiter ask a candidate about
    // age, religion, family plans etc., however it got into the skill list.
    if (PROTECTED_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(skill))) return "";
    if (detectPromptInjection(skill).length) return "";
    return skill;
}

function pick(list, limit, seen) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        if (out.length >= limit) break;
        const skill = questionSkill(raw);
        const key = skill.toLowerCase();
        if (!skill || seen.has(key)) continue;
        seen.add(key);
        out.push(skill);
    }
    return out;
}

export default function questions({ missing = [], unsupported = [] } = {}) {
    const seen = new Set();

    const q = pick(missing, MAX_MISSING_QUESTIONS, seen).map(
        (skill) => `Can you explain your experience with ${skill}?`
    );

    // Required skills the CV lists without showing them in any actual work -
    // the ones most worth probing.
    for (const skill of pick(unsupported, MAX_UNSUPPORTED_QUESTIONS, seen)) {
        q.push(`Your CV lists ${skill} - can you walk me through a piece of work where you used it?`);
    }

    return q;
}
