export function applyKnockouts(candidate,job,score){

const failed=[];

for(const rule of job.knockout_requirements||[]){

const value=(candidate[rule.field]||"")
.toString()
.toLowerCase();

if(rule.required&&

!value.includes(

rule.value.toLowerCase()

)){

failed.push(rule);

}

}

if(!failed.length){

return{

score,

failed

};

}

return{

score:Math.min(score,40),

failed

};

}