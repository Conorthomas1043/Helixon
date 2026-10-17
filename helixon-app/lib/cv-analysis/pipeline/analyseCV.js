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
// That saves a Claude call per CV in a bulk upload, and since each call can
// read the role slightly differently, it keeps every candidate in a batch
// scored against the same requirements.
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





// onProgress(step): called as each stage finishes, with the index of the
// stage now under way (1 reading the role, 2 weighing the evidence, 3
// writing the assessment - app/analyse's RUN_STEPS), so /api/run can stream
// real progress. A callback that throws never stops the analysis.
//
// cvText/extracted: a CV already on file (screening a saved candidate
// against another job) - its stored text and extraction are reused, so
// there's no file to read and one Claude round trip fewer.
export default async function analyseCV(
    file,
    jobText,
    { blind = false, jobParsed: knownJob = null, cvText: knownCvText = null, extracted: knownExtracted = null, onProgress = null } = {}
){

    const progress = (step) => {
        try {
            onProgress?.(step);
        } catch {
            // Progress is a courtesy; the analysis carries on regardless.
        }
    };



    if(!file && !knownCvText){

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
        knownCvText || await extractCvText(file);

    progress(1);




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
    // other, and each is a full Claude round trip.
    const [extracted, jobParsed] =
        await Promise.all([
            knownExtracted && typeof knownExtracted === "object" && Object.keys(knownExtracted).length
                ? knownExtracted
                : candidateExtractor(cvText),
            parseJob(jobText, knownJob),
        ]);




    progress(2);

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

    // Same for the structured candidate: the name and employers are blanked,
    // so the judgement prompt never sees an employer (positions[].employer)
    // and result.summary - shown to the recruiter - can't open with the
    // candidate's real name.
    const scoringCandidate = blind
        ? {
            ...extracted,
            name: "Candidate",
            current_employer: "",
            positions: (extracted.positions || []).map((p) => ({ ...p, employer: "" })),
        }
        : extracted;

    const result =
        await scoreCandidate(
            scoringCandidate,
            jobParsed,
            scoringText
        );

    progress(3);

    // The stored result keeps the real extraction (the recruiter can
    // unblind later); only what scoring saw and said was redacted.
    if (blind) {
        result.candidate = extracted;
    }







    return {


        cvText,


        extracted,


        jobParsed,


        result


    };

}
