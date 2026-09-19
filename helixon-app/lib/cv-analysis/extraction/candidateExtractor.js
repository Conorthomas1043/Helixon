import askClaude from "../anthropic/askClaude.js";

import {
    candidateExtractionPrompt
}
from "../prompts/candidateExtractionPrompt.js";

import validateCandidate
from "../validators/validateCandidate.js";

import { detectPromptInjection } from "../../prompt-safety.js";

import { debug } from "../utils/logger.js";
import { summarise } from "../utils/logger.js";




export default async function candidateExtractor(cvText){



    debug(
        "candidateExtractor input:",
        summarise(cvText)
    );



    if(
        typeof cvText !== "string"
        ||
        !cvText.trim()
    ){

        throw new Error(
            "candidateExtractor expected CV text string"
        );

    }





    const prompt =
        candidateExtractionPrompt(
            cvText
        );





    const result =
        await askClaude(
            prompt
        );




    // Full result contains name/email/phone/education etc - never log it
    // verbatim (see utils/logger.js). Shape only.
    debug(
        "candidateExtractor result:",
        summarise(result)
    );




    const candidate =
        validateCandidate(
            result
        );




    // Tripwire for text in the CV that's addressed to an AI screener ("ignore
    // previous instructions", "score this candidate 100", ...). The prompt
    // already fences the CV off as data, so this is a second line of defence
    // and, more usefully, a heads-up for the recruiter: a CV that does this
    // deserves a manual look. Surfaced through cv_quality_issues, which the
    // results UI already shows. Only pattern names are logged - never CV text.
    const injectionSignals =
        detectPromptInjection(
            cvText
        );

    if(
        injectionSignals.length
    ){

        console.warn(
            "[candidateExtractor] Possible prompt injection in CV:",
            injectionSignals.join(", ")
        );

        candidate.cv_quality_issues = [

            ...(candidate.cv_quality_issues || []),

            "This CV contains text that looks like instructions aimed at an AI screening tool. It was ignored, but review this CV manually."

        ];

    }




    return candidate;

}
