export function estimateProficiency(detail){

let score=0;

score+=Math.min(detail.years_used||0,10)*5;

if(detail.depth==="Core")

score+=30;

if(detail.depth==="Used")

score+=15;

const age=

new Date().getFullYear()

-(detail.last_used_year||2000);

if(age<2)

score+=20;

else if(age<5)

score+=10;

return{

skill:detail.skill,

score:Math.min(score,100),

level:

score>85?"Expert":

score>70?"Advanced":

score>50?"Professional":

score>25?"Working":

"Basic"

};

}