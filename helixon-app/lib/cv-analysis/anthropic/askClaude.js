import { anthropic } from "../anthropic.js";

import cleanJson from "../utils/cleanJson.js";

import sanitise from "../utils/sanitise.js";

import {
    MODEL,
    MAX_RETRIES,
    EXTRACTION_EFFORT
}
from "../config.js";

import systemPrompt
from "../prompts/systemPrompt.js";

import { debug, error, summarise } from "../utils/logger.js";

import { sleep, backoff, retryable } from "../utils/retry.js";

// retryable()/backoff()/sleep() existed as unused utilities before this -
// defined, exported, never imported by anything that actually calls
// Claude, so a single transient failure (rate limit, a 5xx from
// Anthropic's side) had no recovery anywhere in the pipeline. Every
// extraction and scoring call goes through this function, so wiring the
// retry in here covers all of them at once.
async function withRetry(fn) {
    let lastError;

    for (let attemptNum = 0; attemptNum <= MAX_RETRIES; attemptNum++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            // err.status is set on Anthropic SDK API errors (rate limits,
            // 5xx). Errors this function raises itself below (empty
            // response, unparseable JSON) have no .status, so retryable()
            // - which only matches 429/5xx - correctly treats those as
            // not retryable and rethrows immediately rather than retrying
            // a deterministic failure 3 extra times for nothing.
            if (attemptNum >= MAX_RETRIES || !retryable(err?.status)) {
                throw err;
            }

            error(`Claude request failed (status ${err?.status}), retrying (attempt ${attemptNum + 1}/${MAX_RETRIES})`);
            await sleep(backoff(attemptNum));
        }
    }

    throw lastError;
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
