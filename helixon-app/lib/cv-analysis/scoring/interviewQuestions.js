// Deliberately never asks about employment gaps - see riskEngine.js and
// scoreCandidate.js for why gaps aren't treated as a negative signal. (It
// used to add "Can you explain any employment gaps?" whenever risk was
// High, even though risk is computed without looking at gaps at all.)
export default function questions({ missing = [], unsupported = [] }){

const q=[];

for(const skill of missing){

q.push(

`Can you explain your experience with ${skill}?`

);

}

// Required skills the CV lists without showing them in any actual work -
// the ones most worth probing.
for(const skill of unsupported.slice(0,3)){

q.push(

`Your CV lists ${skill} - can you walk me through a piece of work where you used it?`

);

}

return q;

}
