export default function diversityMetrics(results){

return{

averageScore:

results.reduce(

(a,b)=>a+b.overall,

0

)/results.length,

interviewRate:

results.filter(

r=>r.overall>=75

).length/

results.length

};

}