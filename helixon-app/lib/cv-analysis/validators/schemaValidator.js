export function requireFields(

object,

fields

){

const missing=[];

for(

const field of fields

){

if(

object[field]===undefined

){

missing.push(field);

}

}

return{

valid:

missing.length===0,

missing

};

}