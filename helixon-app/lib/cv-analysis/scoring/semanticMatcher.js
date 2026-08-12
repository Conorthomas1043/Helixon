const taxonomy={

javascript:[

"ecmascript",

"node",

"nodejs",

"node.js"

],

typescript:[

"ts"

],

react:[

"reactjs",

"react.js",

"next",

"nextjs",

"next.js"

],

aws:[

"amazon web services",

"lambda",

"ec2",

"s3",

"cloudformation"

],

docker:[

"containers",

"containerisation",

"containerization"

],

kubernetes:[

"k8s"

]

};

export function semanticMatch(required,candidate){

required=required.toLowerCase();

const skills=

candidate.map(

x=>x.toLowerCase()

);

if(skills.includes(required))

return{

matched:true,

exact:true

};

const related=

taxonomy[required]||[];

for(const item of related){

if(skills.includes(item))

return{

matched:true,

exact:false,

via:item

};

}

return{

matched:false

};

}