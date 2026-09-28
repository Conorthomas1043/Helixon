import { anthropic } from "../anthropic.js";

import cleanJson from "../utils/cleanJson.js";

import sanitise from "../utils/sanitise.js";

import {
    MODEL,
    EXTRACTION_EFFORT
}
from "../config.js";

import systemPrompt
from "../prompts/systemPrompt.js";

import { debug, error, summarise } from "../utils/logger.js";

// Transient API failures (429, 5xx/529 overloaded, dropped connections,
// timeouts) are retried by the Anthropic client itself - see anthropic.js
// maxRetries - which also honours the API's retry-after header. This used
// to wrap a second 3-retry loop around the client's own default 2 retries,
// so one struggling request could be attempted up to 12 times and blow
// straight through the route's time limit.
//
// What the client can't know to retry is a response that arrived fine but
// isn't usable JSON. The model samples, so that's not deterministic - a
// second attempt almost always parses - and one bad sample used to fail the
// whole analysis with a 500.
const MALFORMED_OUTPUT_RETRIES = 1;

async function withRetry(fn) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (!err?.malformedOutput || attempt >= MALFORMED_OUTPUT_RETRIES) {
                throw err;
            }
            error(`Claude returned unusable output (${err.message}), retrying`);
        }
    }
}

function malformed(message) {
    const err = new Error(message);
    err.malformedOutput = true;
    return err;
}



// No `temperature`: claude-sonnet-5 (config.js MODEL) removed the sampling
// parameters and rejects any request that sends one with a 400. This used
// to pass temperature: 0 on every call, so every extraction failed and
// /api/run answered 500 before a candidate was ever saved.
//
// effort: how much Sonnet 5 thinks before answering. Left unset, it thinks
// at "high" on every call - most of the latency of a structured-extraction
// call was thinking tokens the task didn't need. Extraction (copying facts
// out of a CV/job into a schema) runs at "low"; judgement calls pass
// "medium". See config.js EXTRACTION_EFFORT / JUDGMENT_EFFORT.
export default async function askClaude(userPrompt, { effort = EXTRACTION_EFFORT } = {}){
    return withRetry(() => sendToClaude(userPrompt, effort));
}

async function sendToClaude(userPrompt, effort){



    const response =
        await anthropic.messages.create({

            model:MODEL,

            // Sonnet 5 thinks adaptively by default and thinking counts
            // against max_tokens - 8000 risked cutting the JSON off mid-way.
            max_tokens:16000,

            output_config:{ effort },

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






    if(response?.stop_reason === "refusal"){

        throw new Error(
            "Claude declined to analyse this content"
        );

    }

    if(response?.stop_reason === "max_tokens"){

        error("Claude response hit max_tokens");

        throw new Error(
            "Claude response was cut off"
        );

    }

    // Only text blocks - thinking blocks come back first on Sonnet 5.
    const text =
        response
        ?.content
        ?.filter(x=>x.type === "text")
        .map(x=>x.text || "")
        .join("");






    if(!text){


        error(
            "Claude empty response, stop_reason:",
            response?.stop_reason
        );


        throw malformed(
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

        throw malformed(
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


        throw malformed(
            "Claude returned invalid JSON"
        );


    }


}
