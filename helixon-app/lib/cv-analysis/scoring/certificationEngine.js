export function analyseCertifications(

certifications=[]

){

const currentYear=

new Date().getFullYear();

const valid=[];

const expired=[];

for(const cert of certifications){

if(

cert.expiry_year&&

cert.expiry_year<currentYear

){

expired.push(cert);

}else{

valid.push(cert);

}

}

return{

valid,

expired,

score:

Math.min(

100,

valid.length*20

)

};

}