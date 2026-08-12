export default function validateJob(job={}){

return{

title:"Unknown",

required_skills:[],

preferred_skills:[],

importance:[],

knockout_requirements:[],

industry:"Unknown",

min_years_experience:0,

...job

};

}