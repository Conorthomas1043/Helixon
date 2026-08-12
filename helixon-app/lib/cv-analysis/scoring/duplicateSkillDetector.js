export default function duplicates(

skills=[]

){

const seen=new Set();

const dup=[];

for(const skill of skills){

const key=

skill

.toLowerCase()

.trim();

if(

seen.has(key)

){

dup.push(skill);

}else{

seen.add(key);

}

}

return dup;

}