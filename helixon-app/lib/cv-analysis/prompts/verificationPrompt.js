export function verificationPrompt(result){

return `

You are acting as a QA recruiter.

Check:

- unsupported skills

- hallucinated experience

- duplicate skills

- score inflation

Return JSON

{

"approved":true,

"issues":[],

"adjustments":[]

}

Data

${JSON.stringify(result)}

`;

}