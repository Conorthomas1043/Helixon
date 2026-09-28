import {
    extractCvText,
    candidateExtractor,
    jobExtractor
}
from "../extraction/index.js";


import scoreCandidate
from "../scoring/scoreCandidate.js";

import { buildBlindCvText } from "../scoring/blindRedaction.js";

import { debug, summarise } from "../utils/logger.js";

import validateJob from "../validators/validateJob.js";

import { getCached as getCachedJob, setCached as setCachedJob } from "../cache/jobCache.js";


// Job extraction, reusing a result when we already have one: the caller's
// parsed job (a saved job being re-used - every CV after the first in a
// bulk run), or this server instance's cache of recently parsed job texts.
// A bulk upload of 50 CVs against one role used to send the identical job
// description through Claude 50 times, and each run could read the role
// slightly differently, so candidates in the same batch weren't scored
// against quite the same requirements.
async function parseJob(jobText, knownJob) {

    if (knownJob && Array.isArray(knownJob.required_skills)) {
        return validateJob(knownJob);
    }

    const cached = getCachedJob(jobText);
    if (cached) return cached;

    const parsed = await jobExtractor(jobText);
    setCachedJob(jobText, parsed);
    return parsed;
}





export default async function analyseCV(
    file,
    jobText,
    { blind = false, jobParsed: knownJob = null } = {}
){



    if(!file){

        throw new Error(
            "CV file missing"
        );

    }



    if(
        typeof jobText !== "string"
        ||
        !jobText.trim()
    ){

        throw new Error(
            "Job description missing"
        );

    }







    /*
        STEP 1

        Convert uploaded file into text

        PDF/DOCX
              |
              v
          cvText string

    */


    const cvText =
        await extractCvText(file);




    debug(
        "analyseCV cvText:",
        summarise(cvText)
    );



    if(
        typeof cvText !== "string"
    ){

        throw new Error(
            "analyseCV expected CV text string"
        );

    }






    /*
        STEP 2

        Extract candidate information and job requirements

        cvText string        job description
              |                     |
              v                     v
        candidate JSON          job JSON

    */


    // Run together - candidate and job extraction don't depend on each
    // other, and each is a full Claude round trip. They used to run one
    // after the other.
    const [extracted, jobParsed] =
        await Promise.all([
            candidateExtractor(cvText),
            parseJob(jobText, knownJob),
        ]);




    // Contains name/email/phone/education - shape only, never the full
    // extracted candidate (see utils/logger.js).
    debug(
        "analyseCV extracted:",
        summarise(extracted)
    );




    debug(
        "analyseCV jobParsed:",
        summarise(jobParsed)
    );







    /*
        STEP 3

        Score candidate

        candidate JSON
        +
        job JSON

              |
              v

        score result

    */


    // Blind screening redacts what extraction just identified (name,
    // contact details, location, employer, institutions) out of the text
    // scoring actually sees, rather than only redacting the display copy
    // returned to the recruiter afterward - see blindRedaction.js.
    const scoringText = blind
        ? buildBlindCvText(cvText, extracted)
        : cvText;

    const result =
        await scoreCandidate(
            extracted,
            jobParsed,
            scoringText
        );







    return {


        cvText,


        extracted,


        jobParsed,


        result


    };

}
