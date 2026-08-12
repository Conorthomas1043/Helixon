export default function teamFit(

candidate,

teamSkills

){

let score=0;

for(const skill of teamSkills){

if(

candidate.skills.includes(skill)

)

score++;

}

return Math.round(

score/

teamSkills.length

*100

);

}