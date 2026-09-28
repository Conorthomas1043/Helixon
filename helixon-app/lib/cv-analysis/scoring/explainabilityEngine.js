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
