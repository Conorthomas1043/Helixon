const bands = {

  Junior: [28000, 42000],

  Mid: [45000, 70000],

  Senior: [70000, 100000],

  Lead: [95000, 130000],

  Principal: [120000, 180000]

};


export function estimateSalary(candidate = {}) {

  let seniority = "Junior";


  const years =
    Number(candidate?.years_experience) || 0;


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


  return {

    seniority,

    currency: "GBP",

    low,

    high,

    confidence: years > 0 ? 85 : 40

  };

}