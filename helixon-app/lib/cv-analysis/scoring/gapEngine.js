export function analyseEmploymentGaps(

positions=[]

){

const gaps=[];

const sorted=[...positions]

.sort(

(a,b)=>

(b.end_year||9999)-

(a.end_year||9999)

);

for(let i=0;i<sorted.length-1;i++){

const current=sorted[i];

const next=sorted[i+1];

if(

current.end_year&&

next.start_year

){

const gap=

current.end_year-

next.start_year;

if(gap>1){

gaps.push({

years:gap,

recent:i===0

});

}

}

}

return{

gaps,

largest:

Math.max(

0,

...gaps.map(

g=>g.years

)

)

};

}