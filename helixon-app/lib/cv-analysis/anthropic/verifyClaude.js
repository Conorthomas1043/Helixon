import askClaude from "./askClaude.js";

import { verificationPrompt }

from "../prompts/verificationPrompt.js";

export default async function verifyClaude(result){

return askClaude(

verificationPrompt(result)

);

}