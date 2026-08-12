import askClaude from "../anthropic/askClaude.js";

import {
    jobExtractionPrompt
}
from "../prompts/jobExtractionPrompt.js";

import validateJob
from "../validators/validateJob.js";





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





    console.log(
        "CLAUDE JOB RESULT:",
        result
    );






    return validateJob(
        result
    );


}