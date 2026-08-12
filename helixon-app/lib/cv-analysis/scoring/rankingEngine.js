export function rank(results){

results.sort(

(a,b)=>

b.overall-a.overall

);

let position=1;

for(const r of results){

r.rank=position++;

}

return results;

}