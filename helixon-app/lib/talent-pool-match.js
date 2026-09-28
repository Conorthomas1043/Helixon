// A quick, free first pass over the talent pool for a job: which of the
// job's skills each saved candidate's CV mentions, plus experience against
// the job's minimum. No AI and nothing stored - it only decides who is worth
// a full screening (app/api/candidates/[id]/rescreen), which is the real
// score.

function normalise(text) {
  return ` ${String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")} `;
}

// Short or symbol-y skills ("C#", "Go", "R") only count as whole words.
export function mentionsSkill(haystack, skill) {
  const needle = normalise(skill).trim();
  if (!needle) return false;
  return haystack.includes(` ${needle} `) || haystack.includes(` ${needle}.`) || haystack.includes(` ${needle}s `);
}

function skillName(s) {
  return typeof s === "string" ? s : s?.name || s?.skill || "";
}

// job: { requiredSkills, preferredSkills, minYearsExperience, title }
// candidate: { skills, cvText, yearsExperience, currentTitle }
// Returns { fit: 0-100 | null, matched, missing, preferredMatched, experienceOk }
export function quickFit(job, candidate) {
  const required = (job?.requiredSkills || []).map(skillName).filter(Boolean);
  const preferred = (job?.preferredSkills || []).map(skillName).filter(Boolean);
  const text = normalise([candidate?.cvText, (candidate?.skills || []).map(skillName).join(" "), candidate?.currentTitle].join(" "));

  const matched = required.filter((s) => mentionsSkill(text, s));
  const missing = required.filter((s) => !matched.includes(s));
  const preferredMatched = preferred.filter((s) => mentionsSkill(text, s));

  const minYears = Number(job?.minYearsExperience) || 0;
  const years = Number(candidate?.yearsExperience);
  const experienceOk = minYears > 0 && Number.isFinite(years) ? years >= minYears : null;

  // Nothing to compare against - say so rather than invent a number.
  if (required.length === 0 && preferred.length === 0 && experienceOk === null) {
    return { fit: null, matched, missing, preferredMatched, experienceOk };
  }

  // Required skills carry most of the weight, then experience, then
  // nice-to-haves.
  let score = 0;
  let weight = 0;
  if (required.length) {
    score += (matched.length / required.length) * 70;
    weight += 70;
  }
  if (experienceOk !== null) {
    score += experienceOk ? 20 : Math.min(1, years / minYears) * 10;
    weight += 20;
  }
  if (preferred.length) {
    score += (preferredMatched.length / preferred.length) * 10;
    weight += 10;
  }
  return { fit: Math.round((score / weight) * 100), matched, missing, preferredMatched, experienceOk };
}
