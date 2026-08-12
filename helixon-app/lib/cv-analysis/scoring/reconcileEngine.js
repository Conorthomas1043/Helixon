export function reconcile(

score,

verification

){

if(

verification.approved

)return score;

for(

const adjustment

of verification.adjustments

){

switch(adjustment.type){

case"removeSkill":

score.matched_skills=

score.matched_skills

.filter(

s=>s!==adjustment.skill

);

break;

case"deduct":

score.overall-=

adjustment.points;

break;

}

}

score.overall=

Math.max(

0,

Math.min(

100,

score.overall

)

);

return score;

}