const ORDER=[

"intern",

"junior",

"developer",

"engineer",

"senior",

"lead",

"principal",

"manager",

"head",

"director"

];

function level(title){

title=(title||"").toLowerCase();

for(let i=ORDER.length-1;i>=0;i--){

if(title.includes(ORDER[i]))

return i;

}

return 0;

}

export function analyseProgression(positions){

if(positions.length<2){

return{

progression:"Unknown",

score:50

};

}

const first=level(

positions.at(-1).title

);

const last=level(

positions[0].title

);

if(last>first){

return{

progression:"Positive",

score:100

};

}

if(last===first){

return{

progression:"Static",

score:60

};

}

return{

progression:"Regression",

score:20

};

}