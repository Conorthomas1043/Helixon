export function calculateConfidence({

evidence,

cvIssues,

matched,

required

}){

let confidence=100;

confidence-=cvIssues.length*10;

confidence-=

evidence.filter(

e=>!e.supported

).length*5;

confidence-=Math.max(

0,

required-matched

)*3;

confidence=Math.max(

20,

confidence

);

return{

confidence,

range:{

low:Math.max(0,confidence-5),

high:Math.min(100,confidence+5)

}

};

}