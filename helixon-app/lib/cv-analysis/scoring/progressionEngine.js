// Seniority by title keyword, for any profession - highest level first.
// Only used as the fallback when the Claude judgement is unavailable (see
// fitJudgeEngine.js). It used to be a 10-word tech ladder ("intern" ...
// "developer", "engineer" ... "director"), so "Nurse", "Sales Executive"
// or "Store Manager" all scored as level 0, the same as an intern.
const LEVELS=[
[8,["chief","ceo","cfo","coo","cto","cmo","founder","owner","managing director","partner","president"]],
[7,["director","vice president","vp","head of"]],
[6,["general manager","senior manager","principal"]],
[4,["assistant manager","deputy manager","team leader","team lead","supervisor","charge nurse","ward sister","foreman","chef de partie"]],
[5,["manager","head chef","sous chef","matron"]],
[4,["lead"]],
[3,["senior","specialist","consultant"]],
[1,["assistant","junior","graduate","trainee","apprentice","commis"]],
[0,["intern","internship","work experience","placement"]]
];

// A title matching nothing - most titles in most professions ("Nurse",
// "Accountant", "Developer", "Sales Executive", "Teacher") - is a
// qualified, mid-level role.
const DEFAULT_LEVEL=2;

function level(title){
title=` ${(title||"").toLowerCase().replace(/[^a-z]+/g," ")} `;
for(const [lvl,words] of LEVELS){
if(words.some(w=>title.includes(` ${w} `)))
return lvl;
}
return DEFAULT_LEVEL;
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