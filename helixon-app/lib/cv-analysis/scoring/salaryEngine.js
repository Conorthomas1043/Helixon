// A rough salary guide for this candidate in this role.
//
// Anchored on the role's own salary range - the one the job advertises,
// or job extraction's estimate for the role, seniority and location (see
// jobExtractionPrompt.js market_salary) - and placed within it by how the
// candidate's relevant experience compares with what the role asks for.
// That works for any job: a care assistant and a solicitor get their own
// markets. It used to be one fixed set of UK tech salary bands picked by
// years of experience, so e.g. ten years as a care worker came out at
// £120k-£180k.
//
// For a job parsed before market_salary existed, the old years-based bands
// are still used - but only for technology roles (or an unknown family),
// since that's the only market they describe; otherwise no estimate.

const TECH_BANDS = {

  Junior: [28000, 42000],

  Mid: [45000, 70000],

  Senior: [70000, 100000],

  Lead: [95000, 130000],

  Principal: [120000, 180000]

};


function yearsPhrase(years, relevant) {
  const y = Math.round(years * 10) / 10;
  return `${y} ${relevant ? "relevant " : ""}year${y === 1 ? "" : "s"} of experience`;
}


function techBandEstimate(years, relevant) {

  let seniority = "Junior";

  if (years >= 10) seniority = "Principal";
  else if (years >= 8) seniority = "Lead";
  else if (years >= 5) seniority = "Senior";
  else if (years >= 2) seniority = "Mid";

  const [low, high] = TECH_BANDS[seniority];

  return {
    seniority,
    currency: "GBP",
    low,
    high,
    confidence: years > 0 ? 40 : 20,
    rationale: `Rough UK technology-market guide based only on ${yearsPhrase(years, relevant)} - it doesn't account for location or specialism.`,
  };
}


export function estimateSalary(candidate = {}, { relevantYears = null, job = {} } = {}) {

  const totalYears = Number(candidate?.years_experience) || 0;

  const relevant = Number.isFinite(relevantYears) && relevantYears !== null;

  const years = relevant ? relevantYears : totalYears;

  const advertisedText = typeof job?.salary_range === "string" ? job.salary_range.trim() : "";

  const market = job?.market_salary;


  if (market && market.low > 0 && market.high >= market.low) {

    // Where in the role's range this candidate is likely to land, from
    // their relevant experience against what the role asks for (or 3
    // years when it doesn't say).
    const expected = Math.max(1, Number(job.min_years_experience) || 3);
    const ratio = years / expected;
    const span = market.high - market.low;

    const [from, to, position] =
      ratio < 0.75 ? [0, 0.4, "lower end"] :
      ratio > 1.75 ? [0.6, 1, "upper end"] :
      [0.25, 0.75, "middle"];

    const round = (n) => Math.round(n / 500) * 500;

    const source = advertisedText
      ? `the role's advertised range (${advertisedText})`
      : "the typical market range for this role (an AI estimate)";

    return {
      seniority: position === "upper end" ? "Upper range" : position === "lower end" ? "Lower range" : "Mid range",
      currency: market.currency || "GBP",
      low: round(market.low + span * from),
      high: round(market.low + span * to),
      confidence: advertisedText ? 60 : 40,
      rationale: `The ${position} of ${source}, given ${yearsPhrase(years, relevant)} against the ${Number(job.min_years_experience) ? `${job.min_years_experience} years` : "experience"} the role asks for.`,
    };
  }


  const family = job?.job_family || "";

  if (family === "" || family === "technology") {

    const estimate = techBandEstimate(years, relevant);

    if (advertisedText) estimate.rationale += ` The role advertises ${advertisedText}.`;

    return estimate;
  }


  return null;
}
