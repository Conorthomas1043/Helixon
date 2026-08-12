import {

analyseProgression

}

from "../scoring/progressionEngine.js";

const result=

analyseProgression([

{

title:"Lead Developer"

},

{

title:"Developer"

}

]);

console.assert(

result.score===100

);