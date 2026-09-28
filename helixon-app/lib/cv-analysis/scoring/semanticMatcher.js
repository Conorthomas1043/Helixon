import taxonomy from "../models/skillTaxonomy.json" with { type: "json" };

import { normaliseSkill, containsPhrase } from "../utils/skillNormaliser.js";

// Single source of truth for skill synonyms lives in
// models/skillTaxonomy.json - add a new skill or alias there and every
// caller of semanticMatch picks it up automatically, no code change
// needed. This was previously a second, smaller taxonomy hardcoded here
// that had drifted out of sync with the JSON file (which nothing
// actually imported).
//
// The index below is built once at module load and is bidirectional:
// each group's canonical name AND every alias map to the full set of
// normalised terms in that group, so a required skill of "Kubernetes"
// matches a candidate who wrote "K8s" and vice versa.
const TAXONOMY_INDEX = buildTaxonomyIndex(taxonomy);

function buildTaxonomyIndex(source) {
    const index = new Map();

    for (const [canonical, aliases] of Object.entries(source)) {
        const group = [canonical, ...aliases].map(normaliseSkill).filter(Boolean);
        const groupSet = new Set(group);

        for (const term of group) {
            // If a term legitimately belongs to more than one group (rare,
            // but taxonomy data can grow over time), merge rather than
            // overwrite so no existing relationship is silently lost.
            const existing = index.get(term);
            index.set(term, existing ? new Set([...existing, ...groupSet]) : groupSet);
        }
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
