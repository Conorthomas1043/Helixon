const feedback=[];

export function saveFeedback({

candidate,

job,

score,

decision

}){

feedback.push({

candidate,

job,

score,

decision,

timestamp:Date.now()

});

}

export function previousFeedback(){

return feedback;

}

export function successRate(){

if(!feedback.length)

return 0;

const accepted=

feedback.filter(

x=>x.decision==="hire"

).length;

return accepted/

feedback.length;

}