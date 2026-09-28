// A rough salary guide from years of experience alone - no job title,
// location, industry or specialism goes into it, so it's presented with a
// rationale saying exactly that, and a confidence to match. (It used to
// report 85% confidence for what is a five-band lookup on one number.)
//
// Uses years relevant to the role when scoring produced them (see
// fitJudgeEngine.js) - ten years in an unrelated field isn't senior pay
// for this job - and falls back to total years otherwise.

const bands = {

  Junior: [28000, 42000],

  Mid: [45000, 70000],

  Senior: [70000, 100000],

  Lead: [95000, 130000],

  Principal: [120000, 180000]

};


export function estimateSalary(candidate = {}, { relevantYears = null, jobSalaryRange = "" } = {}) {

  const totalYears = Number(candidate?.years_experience) || 0;

  const useRelevant = Number.isFinite(relevantYears) && relevantYears !== null;

  const years = useRelevant ? relevantYears : totalYears;


  let seniority = "Junior";

  if (years >= 10) {

    seniority = "Principal";

  } else if (years >= 8) {

    seniority = "Lead";

  } else if (years >= 5) {

    seniority = "Senior";

  } else if (years >= 2) {

    seniority = "Mid";

  }


  const [low, high] = bands[seniority];

  const yearsText = `${Math.round(years * 10) / 10} ${useRelevant ? "relevant " : ""}year${years === 1 ? "" : "s"} of experience`;

  const advertised = typeof jobSalaryRange === "string" && jobSalaryRange.trim()
    ? ` The role advertises ${jobSalaryRange.trim()}.`
    : "";


  return {

    seniority,

    currency: "GBP",

    low,

    high,

    confidence: years > 0 ? 45 : 20,

    rationale: `Rough UK guide based only on ${yearsText} - it doesn't account for location, industry or specialism.${advertised}`

  };

}
