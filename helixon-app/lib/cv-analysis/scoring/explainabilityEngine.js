import { SCORE_WEIGHTS } from "../config.js";

export function buildBreakdown({

required,

preferred,

experience,

career,

industry,

achievements = 0

}){

return{

RequiredSkills:required,

PreferredSkills:preferred,

Experience:experience,

Career:career,

Industry:industry,

Achievements:achievements,

Total:

required+

preferred+

experience+

career+

industry+

achievements

};

}

export function recruiterSummary(

breakdown

){

return`

Required Skills : ${breakdown.RequiredSkills}/${SCORE_WEIGHTS.required}

Experience : ${breakdown.Experience}/${SCORE_WEIGHTS.experience}

Preferred : ${breakdown.PreferredSkills}/${SCORE_WEIGHTS.preferred}

Industry : ${breakdown.Industry}/${SCORE_WEIGHTS.industry}

Career : ${breakdown.Career}/${SCORE_WEIGHTS.career}

Achievements : ${breakdown.Achievements ?? 0}/${SCORE_WEIGHTS.achievements}

----------------------------

Total : ${breakdown.Total}/100

`;

}
