import { jsonForPrompt } from "../../prompt-safety.js";

export function recruiterSummaryPrompt(result){

return `

Produce a recruiter report.

Requirements:

- Explain score.
- Explain strengths.
- Explain weaknesses.
- Explain hiring recommendation.
- Mention unsupported skills removed.
- Mention confidence.
- Mention benchmark percentile.

JSON only.

Data

<untrusted_data>
${jsonForPrompt(result)}
</untrusted_data>

`;

}