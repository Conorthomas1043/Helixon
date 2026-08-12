export function normaliseSkill(skill=""){

return skill

.toLowerCase()

.replace(/[._/-]/g," ")

.replace(/[^a-z0-9+# ]/g,"")

.replace(/\s+/g," ")

.trim();

}

export function skillMatch(a,b){

const aa=normaliseSkill(a);

const bb=normaliseSkill(b);

if(!aa||!bb)return false;

return aa===bb||aa.includes(bb)||bb.includes(aa);

}