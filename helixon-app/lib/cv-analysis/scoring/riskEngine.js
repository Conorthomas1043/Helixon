export function hiringRisk({

gaps,

confidence,

unsupportedSkills,

expiredCerts

}){

let risk=0;

risk+=gaps*5;

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