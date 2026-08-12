import askClaude from "../anthropic/askClaude.js";

import {
    candidateExtractionPrompt
}
from "../prompts/candidateExtractionPrompt.js";

import validateCandidate
from "../validators/validateCandidate.js";




export default async function candidateExtractor(cvText){



    console.log(
        "candidateExtractor TYPE:",
        typeof cvText
    );


    console.log(
        "candidateExtractor LENGTH:",
        cvText?.length
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





    console.log(
        "CLAUDE CANDIDATE RESULT:",
        result
    );






    return validateCandidate(
        result
    );

}