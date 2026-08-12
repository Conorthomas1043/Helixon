export function buildBreakdown({

required,

preferred,

experience,

career,

industry

}){

return{

RequiredSkills:required,

PreferredSkills:preferred,

Experience:experience,

Career:career,

Industry:industry,

Total:

required+

preferred+

experience+

career+

industry

};

}

export function recruiterSummary(

breakdown

){

return`

Required Skills : ${breakdown.RequiredSkills}/40

Experience : ${breakdown.Experience}/25

Preferred : ${breakdown.PreferredSkills}/15

Industry : ${breakdown.Industry}/10

Career : ${breakdown.Career}/10

----------------------------

Total : ${breakdown.Total}/100

`;

}