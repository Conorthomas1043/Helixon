import {

semanticMatch

}

from "../scoring/semanticMatcher.js";

console.assert(

semanticMatch(

"React",

["NextJS"]

).matched

);

console.assert(

semanticMatch(

"AWS",

["Lambda"]

).matched

);