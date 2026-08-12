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
"summary":"",
"years_experience":0,
"skills":[],
"positions":[],
"education":[],
"certifications":[],
"languages":[],
"industries":[],
"skill_details":[]
}


CV TEXT:

----------------

${cvText}

----------------

Rules:

- Do not invent information.
- Preserve names exactly.
- Extract all skills.
- Extract every job position.
- Extract dates and employers.
- Extract education.
- Extract certifications.
- Extract languages.

Return JSON only.
`;

}