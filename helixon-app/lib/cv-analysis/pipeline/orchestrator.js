import analyseCV from "./analyseCV.js";

import verify from "../scoring/verificationEngine.js";

import { benchmark } from "../scoring/benchmarkEngine.js";

import { estimateSalary } from "../scoring/salaryEngine.js";

import { calculateConfidence }

from "../scoring/confidenceEngine.js";

import { hiringRisk }

from "../scoring/riskEngine.js";

import { buildRecruiterReport }

from "../reporting/recruiterReport.js";

export default async function orchestrate(

cv,

job

){

let result=

await analyseCV(

cv,

job

);

result=

verify(

result.candidate||{},

result

);

result.salary=

estimateSalary(

result.candidate||{}

);

result.benchmark=

benchmark(

result.overall

);

result.confidence=

calculateConfidence({

evidence:

result.evidence,

cvIssues:

result.candidate

?.cv_quality_issues||[],

matched:

result.matched_skills.length,

required:

result.missing_skills.length+

result.matched_skills.length

});

result.risk=

hiringRisk({

gaps:

result.career_progression

?.gaps||0,

confidence:

result.confidence.confidence,

unsupportedSkills:

result.removedUnsupportedSkills.length,

expiredCerts:0

});

return buildRecruiterReport(result);

}