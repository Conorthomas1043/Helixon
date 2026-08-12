const qualificationScore={

phd:100,

doctorate:100,

masters:90,

msc:90,

meng:90,

bachelor:75,

bsc:75,

ba:70,

hnd:55,

hnc:45,

a level:20

};

export function scoreEducation(

education=[]

){

let best=0;

for(const item of education){

const text=

JSON.stringify(item)

.toLowerCase();

for(const key of Object.keys(

qualificationScore

)){

if(text.includes(key))

best=Math.max(

best,

qualificationScore[key]

);

}

}

return best;

}