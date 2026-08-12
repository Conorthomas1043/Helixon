import {skillMatch} from "../utils/skillNormaliser.js";

export function verifyScore(

score,

candidate

){

const verified=[];

const removed=[];

for(const skill of score.matched_skills){

const exists=

candidate.skills.some(

s=>skillMatch(s,skill)

);

if(exists)

verified.push(skill);

else

removed.push(skill);

}

score.matched_skills=verified;

score.removedUnsupportedSkills=

removed;

return score;

}