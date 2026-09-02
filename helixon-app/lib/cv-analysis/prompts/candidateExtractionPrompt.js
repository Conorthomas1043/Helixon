export function candidateExtractionPrompt(cvText){


return `
You are an expert CV parser.

Extract structured candidate information from the CV.

Return ONLY valid JSON.

Schema:

{
"name":"",
"email":"",
"phone":"",
"location":"",
"linkedin":"",
"github":"",
"portfolio_url":"",
"summary":"",
"current_title":"",
"current_employer":"",
"notice_period":"",
"willing_to_relocate":null,
"years_experience":0,
"skills":[],
"positions":[
  {"title":"","employer":"","start_year":0,"end_year":0}
],
"education":[
  {"degree":"","field_of_study":"","institution":"","start_year":0,"end_year":0,"grade":""}
],
"certifications":[
  {"name":"","issuer":"","year":0,"expiry_year":0}
],
"languages":[],
"industries":[],
"skill_details":[
  {"skill":"","last_used_year":0,"years_used":0,"depth":"Mentioned | Used | Expert"}
],
"experience_breakdown":[
  {"area":"","years":0}
],
"cv_quality_issues":[]
}


CV TEXT:

----------------

${cvText}

----------------

Rules:

- Do not invent information. Use "", 0, [] or null for anything not present in the CV.
- Preserve names exactly.
- Extract all skills, including ones only mentioned in project/experience bullet points.
- Extract every job position, most recent first, with employer and start/end years.
- "current_title"/"current_employer" should match the candidate's most recent (or current) position.
- Extract dates and employers.
- Extract education, certifications (including expiry year if stated), and languages.
- "willing_to_relocate" is true/false only if the CV states a relocation preference explicitly, otherwise null.
- "experience_breakdown" is years of experience per skill area/domain the CV supports (e.g. "Backend", "Frontend", "Cloud/DevOps") - infer this only from what the positions/skills actually show.
- "cv_quality_issues" lists concrete problems with the CV itself as a document (e.g. "no dates on earliest role", "inconsistent formatting"), not problems with the candidate.

Return JSON only.
`;

}