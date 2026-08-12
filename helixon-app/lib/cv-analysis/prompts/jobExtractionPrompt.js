export function jobExtractionPrompt(job){

return`

Extract

Required skills

Preferred skills

Minimum years

Industry

Knockout requirements

Return JSON only.

Job Description

${job}

`;

}