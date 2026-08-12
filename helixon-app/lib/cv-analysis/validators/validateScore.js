export default function validateScore(score={}){

const defaults={

match_score:0,

skill_score:0,

experience_score:0,

culture_score:0,

matched_skills:[],

missing_required:[],

strengths:[],

weaknesses:[],

confidence:"Medium",

score_breakdown:{}

};

score={

...defaults,

...score

};

["match_score","skill_score","experience_score","culture_score"]

.forEach(key=>{

score[key]=Math.max(0,

Math.min(100,

Math.round(Number(score[key])||0)));

});

return score;

}