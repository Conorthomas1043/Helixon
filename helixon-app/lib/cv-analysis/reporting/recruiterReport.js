export function buildRecruiterReport(result){

return{

overall:result.overall,

recommendation:

result.overall>=80

?"Strong Hire":

result.overall>=65

?"Interview":

result.overall>=50

?"Possible":

"Reject",

confidence:

result.confidence,

benchmark:

result.benchmark,

salary:

result.salary,

risk:

result.risk,

strengths:

result.matched_skills,

missing:

result.missing_skills,

unsupported:

result.removedUnsupportedSkills,

breakdown:

result.breakdown

};

}