export default function hiringDecision(result){

if(result.overall>=90)

return{

decision:"Hire",

priority:"Immediate"

};

if(result.overall>=75)

return{

decision:"Interview",

priority:"High"

};

if(result.overall>=60)

return{

decision:"Review",

priority:"Medium"

};

return{

decision:"Reject",

priority:"Low"

};

}