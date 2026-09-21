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





export default async function analyseCV(
    file,
    jobText,
    { blind = false } = {}
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

        Extract candidate information

        cvText string
              |
              v
        candidate JSON

    */


    const extracted =
        await candidateExtractor(
            cvText
        );




    // Contains name/email/phone/education - shape only, never the full
    // extracted candidate (see utils/logger.js).
    debug(
        "analyseCV extracted:",
        summarise(extracted)
    );








    /*
        STEP 3

        Extract job requirements

        job description
              |
              v
        job JSON

    */


    const jobParsed =
        await jobExtractor(
            jobText
        );




    debug(
        "analyseCV jobParsed:",
        summarise(jobParsed)
    );







    /*
        STEP 4

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
