import Anthropic from "@anthropic-ai/sdk";
import {
DEFAULT_TIMEOUT,
MODEL
} from "./config.js";

export const anthropic = new Anthropic({

apiKey:process.env.ANTHROPIC_API_KEY,

timeout:DEFAULT_TIMEOUT

});

if(!process.env.ANTHROPIC_API_KEY){

console.error("Missing Anthropic key");

}