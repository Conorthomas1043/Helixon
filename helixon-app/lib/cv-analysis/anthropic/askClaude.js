import { anthropic } from "../anthropic.js";

import cleanJson from "../utils/cleanJson.js";

import sanitise from "../utils/sanitise.js";

import {
    MODEL
}
from "../config.js";

import systemPrompt
from "../prompts/systemPrompt.js";

import { debug, error, summarise } from "../utils/logger.js";





// `temperature` defaults to 0 - extraction must be repeatable (the same CV
// and job text should produce the same structured output every time: same
// candidate re-analysed, re-runs after a bug fix, A/B comparisons). The one
// caller that intentionally overrides this is fitJudgeEngine.js, which
// wants genuine sampling variance to average out via self-consistency
// (median of several samples) rather than one deterministic-but-noisy call.
export default async function askClaude(userPrompt, { temperature = 0 } = {}){



    const response =
        await anthropic.messages.create({

            model:MODEL,

            max_tokens:8000,

            temperature,

            system:systemPrompt,

            messages:[

                {

                    role:"user",

                    content:
                        sanitise(
                            userPrompt
                        )

                }

            ]

        });






    const text =
        response
        ?.content
        ?.map(x=>x.text || "")
        .join("");






    if(!text){


        error(
            "Claude empty response, stop_reason:",
            response?.stop_reason
        );


        throw new Error(
            "Claude returned empty response"
        );

    }






    // The raw/cleaned text is the extracted candidate or job JSON as a
    // string - i.e. full PII (name, email, phone, CV content). Log its
    // shape, not its content (see utils/logger.js). Set
    // CV_PIPELINE_DEBUG=true locally to see full payloads while debugging.
    debug(
        "Claude raw response:",
        summarise(text)
    );




    const cleaned =
        cleanJson(text);





    debug(
        "Claude cleaned JSON:",
        summarise(cleaned)
    );







    if(!cleaned){

        throw new Error(
            "Claude response contained no JSON"
        );

    }







    try{


        return JSON.parse(
            cleaned
        );


    }
    catch(err){


        error(
            "Claude returned invalid JSON, length:",
            cleaned?.length
        );


        // Full content only when explicitly debugging - it may contain
        // candidate/job PII and this is the one place a malformed
        // response needs the actual text to diagnose.
        debug(
            "Invalid JSON content:",
            cleaned
        );


        throw new Error(
            "Claude returned invalid JSON"
        );


    }


}
