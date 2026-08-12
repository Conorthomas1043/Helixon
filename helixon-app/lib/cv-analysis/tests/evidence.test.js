import {

collectEvidence

}

from "../scoring/evidenceEngine.js";

const cv=`

Built React apps

Implemented AWS Lambda

`;

const result=

collectEvidence(

cv,

["React","AWS"]

);

console.assert(

result.length===2

);

console.assert(

result[0].supported

);

console.assert(

result[1].supported

);