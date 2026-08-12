export default function questions(result){

const q=[];

for(const skill of result.missing){

q.push(

`Can you explain your experience with ${skill}?`

);

}

if(

result.risk.level==="High"

){

q.push(

"Can you explain any employment gaps?"

);

}

return q;

}