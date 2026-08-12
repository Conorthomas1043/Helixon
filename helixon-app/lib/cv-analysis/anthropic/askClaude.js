import { anthropic } from "../anthropic.js";

import cleanJson from "../utils/cleanJson.js";

import sanitise from "../utils/sanitise.js";

import {
    MODEL
}
from "../config.js";

import systemPrompt
from "../prompts/systemPrompt.js";





export default async function askClaude(userPrompt){



    const response =
        await anthropic.messages.create({

            model:MODEL,

            max_tokens:8000,

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


        console.error(
            "Claude empty response:",
            response
        );


        throw new Error(
            "Claude returned empty response"
        );

    }






    console.log(
        "CLAUDE RAW:",
        text
    );






    const cleaned =
        cleanJson(text);





    console.log(
        "CLAUDE CLEANED:",
        cleaned
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
    catch(error){


        console.error(
            "BAD CLAUDE JSON:",
            cleaned
        );


        throw new Error(
            "Claude returned invalid JSON"
        );


    }


}