import { semanticMatch }
from "./semanticMatcher.js";


import {
  collectEvidence
}
from "./evidenceEngine.js";


import {
  achievementScore,
  extractAchievements
}
from "./achievementEngine.js";


import {
  analyseProgression
}
from "./progressionEngine.js";


import {
  buildBreakdown
}
from "./explainabilityEngine.js";



export default function scoreCandidate(

  candidate = {},

  job = {},

  rawCV = ""

){


  // protect against non-string CV input

  if(typeof rawCV !== "string"){

    if(rawCV?.text){

      rawCV = rawCV.text;

    }
    else{

      rawCV = JSON.stringify(rawCV);

    }

  }



  const matched = [];

  const missing = [];



  for(
    const skill of (job.required_skills || [])
  ){


    const result =
      semanticMatch(

        skill,

        candidate.skills || []

      );



    if(result.matched){

      matched.push(skill);

    }
    else{

      missing.push(skill);

    }


  }



  const evidence =
    collectEvidence(

      rawCV,

      matched

    );



  const requiredScore =
    Math.round(

      matched.length /

      Math.max(

        1,

        (job.required_skills || []).length

      )

      * 40

    );



  const achievements =
    achievementScore(

      extractAchievements(rawCV)

    );



  const progression =
    analyseProgression(

      candidate.positions || []

    );



  const breakdown =
    buildBreakdown({

      required: requiredScore,

      preferred: 10,

      experience: 20,

      career: progression.score / 10,

      industry: 8

    });



  return {


    // required by orchestrator

    candidate,



    overall:
      breakdown.Total,



    matched_skills:
      matched,



    missing_skills:
      missing,



    evidence,



    breakdown,



    achievement_score:
      achievements,



    career_progression:
      progression



  };


}