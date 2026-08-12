export default function validateSalary(salary){

if(!salary)return null;

if(!salary.low&&!salary.high)return null;

return{

low:Math.round(salary.low),

high:Math.round(salary.high),

currency:salary.currency||"GBP",

seniority:salary.seniority||"Mid",

rationale:salary.rationale||""

};

}