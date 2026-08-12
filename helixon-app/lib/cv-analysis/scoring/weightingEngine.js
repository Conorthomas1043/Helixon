import {IMPORTANCE_MULTIPLIER} from "../config.js";

export function scoreRequirement(requirement,matched){

const weight=IMPORTANCE_MULTIPLIER[

requirement.importance||"Medium"

]||1;

return matched?weight:0;

}

export function totalWeight(reqs){

return reqs.reduce(

(a,b)=>

a+(IMPORTANCE_MULTIPLIER[b.importance||"Medium"]||1)

,0);

}

export function weightedPercentage(reqs,matches){

const total=totalWeight(reqs);

let earned=0;

for(const req of reqs){

const found=matches.includes(req.name);

earned+=scoreRequirement(req,found);

}

if(total===0)return 100;

return Math.round(

earned/total*100

);

}