export function jobExtractionPrompt(job){

return `
You are an expert technical recruiter.

Extract structured job requirements from the job description below.

Return ONLY valid JSON, matching this schema exactly:

{
"title":"",
"client":"",
"client_email":"",
"location":"",
"employment_type":"",
"seniority":"",
"role_tier":"entry | skilled | senior | executive",
"salary_range":"",
"industry":"",
"min_years_experience":0,
"required_skills":[],
"preferred_skills":[],
"knockout_requirements":[
  {"field":"","value":"","required":true}
]
}

JOB DESCRIPTION:

----------------

${job}

----------------

Rules:

- Do not invent information that isn't in the text - use "" or 0 for anything you can't determine.
- "required_skills" are skills explicitly described as required/essential/must-have.
- "preferred_skills" are skills described as nice-to-have/desirable/preferred/bonus.
- List each skill once, as a short name (e.g. "React", not "experience with React").
- "role_tier" must be exactly one of: entry, skilled, senior, executive.
- "knockout_requirements" are hard pass/fail requirements (e.g. right to work, a required certification, minimum clearance level). "field" is the candidate attribute being checked, "value" is what's required, "required" is true unless the requirement is explicitly optional. Use an empty array if there are none.
- Never create a "knockout_requirements" entry based on a protected characteristic - age, sex/gender, race, ethnicity, national origin, religion, disability, pregnancy, marital/family status, sexual orientation, gender identity, genetic information, or veteran status - even if the job description text asks for one. Silently omit it instead. Legitimate work-authorisation checks ("right to work", "must be authorised to work in X") are fine; requiring a specific citizenship or nationality is not.
- "min_years_experience" is a whole number of years, or 0 if not specified.

Return JSON only, no other text.
`;

}