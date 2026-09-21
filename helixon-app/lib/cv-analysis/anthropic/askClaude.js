import { anthropic } from "../anthropic.js";

import cleanJson from "../utils/cleanJson.js";

import sanitise from "../utils/sanitise.js";

import {
    MODEL,
    MAX_RETRIES
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



// `temperature` defaults to 0 - extraction must be repeatable (the same CV
// and job text should produce the same structured output every time: same
// candidate re-analysed, re-runs after a bug fix, A/B comparisons). The one
// caller that intentionally overrides this is fitJudgeEngine.js, which
// wants genuine sampling variance to average out via self-consistency
// (median of several samples) rather than one deterministic-but-noisy call.
export default async function askClaude(userPrompt, { temperature = 0 } = {}){
    return withRetry(() => sendToClaude(userPrompt, temperature));
}

async function sendToClaude(userPrompt, temperature){



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
