export function candidateFingerprint(candidate){

const email=(candidate.email||"")

.toLowerCase()

.trim();

if(email){

return "email:"+email;

}

return "name:"+

(candidate.name||"")

.toLowerCase()

.replace(/[^a-z ]/g,"")

.trim();

}