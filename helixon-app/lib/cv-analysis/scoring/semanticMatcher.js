import taxonomy from "../models/skillTaxonomy.json" with { type: "json" };

import { normaliseSkill, containsPhrase } from "../utils/skillNormaliser.js";

// Single source of truth for skill synonyms lives in
// models/skillTaxonomy.json - add a new skill or alias there and every
// caller of semanticMatch picks it up automatically, no code change
// needed. This was previously a second, smaller taxonomy hardcoded here
// that had drifted out of sync with the JSON file (which nothing
// actually imported).
//
// Each entry is either a plain list of synonyms, or
// { "synonyms": [...], "includes": [...] }:
//   - synonyms are interchangeable with the skill and with each other
//     ("Kubernetes" / "K8s", "Business development" / "BD").
//   - includes are narrower skills/tools that demonstrate the broader one
//     ("SQL" includes "MySQL"; "CRM" includes "Salesforce"). One direction
//     only: a required "CRM" is met by a candidate's "Salesforce", but a
//     required "Salesforce" is not met by "CRM" or by another include
//     ("HubSpot"). The old flat lists treated every name in a group as
//     equal, so e.g. "Redux" counted as "Next.js" and "Django" as "Flask".
//
// The index is built once at module load: required term -> set of
// candidate terms that satisfy it.
const TAXONOMY_INDEX = buildTaxonomyIndex(taxonomy);

function addAll(index, term, terms) {
    // A term can belong to more than one group - merge, never overwrite.
    const existing = index.get(term);
    index.set(term, existing ? new Set([...existing, ...terms]) : new Set(terms));
}

function buildTaxonomyIndex(source) {
    const index = new Map();

    for (const [canonical, entry] of Object.entries(source)) {
        const synonymList = Array.isArray(entry) ? entry : entry?.synonyms || [];
        const includeList = Array.isArray(entry) ? [] : entry?.includes || [];

        const core = [canonical, ...synonymList].map(normaliseSkill).filter(Boolean);
        const includes = includeList.map(normaliseSkill).filter(Boolean);

        for (const term of core) addAll(index, term, [...core, ...includes]);
    }

    return index;
}

// Whole-word fallback: catches cases the taxonomy doesn't (yet) list,
// e.g. a candidate skill of "AWS Lambda" satisfying a required skill of
// "AWS". One direction only - the whole required skill has to appear in
// the candidate's skill. The reverse (any candidate word appearing in the
// requirement) let a candidate's "Management" satisfy "Project Management"
// and "Learning" satisfy "Machine Learning". Word-boundary based rather
// than raw substring so "Java" never matches "JavaScript".
function coversRequirement(requiredNorm, candidateNorm) {
    return containsPhrase(candidateNorm, requiredNorm);
}

export function semanticMatch(required, candidate) {
    const requiredNorm = normaliseSkill(required);

    const candidates = candidate.map((skill) => ({
        original: skill,
        norm: normaliseSkill(skill),
    }));

    const exact = candidates.find((c) => c.norm === requiredNorm);
    if (exact) {
        return { matched: true, exact: true };
    }

    const group = TAXONOMY_INDEX.get(requiredNorm);
    if (group) {
        const alias = candidates.find((c) => group.has(c.norm));
        if (alias) {
            return { matched: true, exact: false, via: alias.original };
        }
    }

    const wholeWord = candidates.find((c) => coversRequirement(requiredNorm, c.norm));
    if (wholeWord) {
        return { matched: true, exact: false, via: wholeWord.original };
    }

    return { matched: false };
}
