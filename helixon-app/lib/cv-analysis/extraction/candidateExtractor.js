import askClaude from "../anthropic/askClaude.js";

import {
    candidateExtractionPrompt
}
from "../prompts/candidateExtractionPrompt.js";

import validateCandidate
from "../validators/validateCandidate.js";

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




    return validateCandidate(
        result
    );

}
