export function scoreIndustry(

candidate,

job

){

if(

!candidate.industries||

!job.industry

)

return 50;

const industries=

candidate.industries

.map(

x=>x.toLowerCase()

);

return industries.includes(

job.industry.toLowerCase()

)

?100

:50;

}