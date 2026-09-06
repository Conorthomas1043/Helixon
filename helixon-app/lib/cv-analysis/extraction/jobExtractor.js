import askClaude from "../anthropic/askClaude.js";

import {
    jobExtractionPrompt
}
from "../prompts/jobExtractionPrompt.js";

import validateJob
from "../validators/validateJob.js";

import { debug, summarise } from "../utils/logger.js";




export default async function jobExtractor(jobText){



    if(
        typeof jobText !== "string"
        ||
        !jobText.trim()
    ){

        throw new Error(
            "jobExtractor expected job description string"
        );

    }






    const prompt =
        jobExtractionPrompt(
            jobText
        );





    const result =
        await askClaude(
            prompt
        );




    // May contain a client name/email pulled from the job text - shape
    // only, never the full parsed object (see utils/logger.js).
    debug(
        "jobExtractor result:",
        summarise(result)
    );




    return validateJob(
        result
    );


}
