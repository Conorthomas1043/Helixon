import Anthropic from "@anthropic-ai/sdk";
import {
DEFAULT_TIMEOUT,
MAX_RETRIES
} from "./config.js";

export const anthropic = new Anthropic({

apiKey:process.env.ANTHROPIC_API_KEY,

timeout:DEFAULT_TIMEOUT,

// The client retries 429/5xx/connection errors/timeouts with backoff and
// honours retry-after - the only retry layer for transient API failures
// (see anthropic/askClaude.js).
maxRetries:MAX_RETRIES

});

if(!process.env.ANTHROPIC_API_KEY){

console.error("Missing Anthropic key");

}