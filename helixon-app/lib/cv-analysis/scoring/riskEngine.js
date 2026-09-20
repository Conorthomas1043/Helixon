// Deliberately does NOT take employment-gap count as an input. Gaps
// correlate heavily with protected characteristics (parental/family leave,
// disability, long-term illness, caregiving) and a CV essentially never
// states why a gap exists, so scoring "has a gap" as inherent risk
// systematically penalises exactly the candidates equality law protects,
// based on a fact the system can't interpret. unsupportedSkills and
// expiredCerts are kept - both are directly job-relevant and not proxies
// for a protected characteristic.
export function hiringRisk({

confidence,

unsupportedSkills,

expiredCerts

}){

let risk=0;

risk+=unsupportedSkills*8;

risk+=expiredCerts*10;

risk+=(100-confidence)/5;

return{

score:Math.min(risk,100),

level:

risk<20

?"Low":

risk<50

?"Medium":

"High"

};

}