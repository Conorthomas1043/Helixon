import orchestrate from "./orchestrator.js";

export default async function batch(

cvs,

job

){

const results=

await Promise.all(

cvs.map(

cv=>

orchestrate(

cv,

job

)

)

);

return results.sort(

(a,b)=>

b.overall-a.overall

);

}