// Points per component, as shown on the report. `total` is the total
// scoreCandidate worked out from the unrounded parts, so rounding each part
// can't move a candidate across a band line; without it, the rounded parts
// are summed.
export function buildBreakdown({
    required,
    preferred,
    experience,
    career,
    industry,
    achievements = 0,
    total = null,
}) {
    return {
        RequiredSkills: required,
        PreferredSkills: preferred,
        Experience: experience,
        Career: career,
        Industry: industry,
        Achievements: achievements,
        Total: total ?? required + preferred + experience + career + industry + achievements,
    };
}
