import {
    extractCvText,
    candidateExtractor,
    jobExtractor
}
from "../extraction/index.js";


import scoreCandidate
from "../scoring/scoreCandidate.js";





export default async function analyseCV(
    file,
    jobText
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




    console.log(
        "analyseCV FINAL CV TYPE:",
        typeof cvText
    );


    console.log(
        "analyseCV FINAL CV LENGTH:",
        cvText?.length
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




    console.log(
        "EXTRACTED CANDIDATE:",
        extracted
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




    console.log(
        "PARSED JOB:",
        jobParsed
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


    const result =
        await scoreCandidate(
            extracted,
            jobParsed
        );







    return {


        cvText,


        extracted,


        jobParsed,


        result


    };

}