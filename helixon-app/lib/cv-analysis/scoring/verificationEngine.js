import {

verifyScore

}

from "./hallucinationVerifier.js";

export default function verify(

candidate,

score

){

score=

verifyScore(

score,

candidate

);

score.verification={

supported:

score.removedUnsupportedSkills.length===0,

removed:

score.removedUnsupportedSkills.length

};

return score;

}