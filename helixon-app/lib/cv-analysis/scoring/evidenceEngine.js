import { skillMatch } from "../utils/skillNormaliser.js";


const HIGH_CONFIDENCE = [

  "built",

  "developed",

  "implemented",

  "designed",

  "architected",

  "led",

  "created",

  "deployed",

  "maintained",

  "migrated",

  "owned",

  "managed"

];



function normaliseCV(cvText = "") {


  if (typeof cvText === "string") {

    return cvText;

  }


  if (cvText?.text) {

    return cvText.text;

  }


  if (cvText?.raw) {

    return cvText.raw;

  }


  if (cvText?.content) {

    return cvText.content;

  }


  return "";

}



export function collectEvidence(cvText = "", skills = []) {


  cvText = normaliseCV(cvText);


  const lines =

    cvText

      .split(/\r?\n/)

      .map(x => x.trim())

      .filter(Boolean);



  return skills.map(skill => {


    const matches = [];



    for (const line of lines) {


      if (!skillMatch(skill,line)) {

        continue;

      }


      const lower =
        line.toLowerCase();



      let confidence = "Low";



      if (
        HIGH_CONFIDENCE.some(
          word => lower.includes(word)
        )
      ) {

        confidence = "High";

      }

      else if (line.length > 35) {

        confidence = "Medium";

      }



      matches.push({

        skill,

        evidence: line,

        confidence

      });


    }



    return {


      skill,


      supported:
        matches.length > 0,


      evidence:
        matches


    };


  });


}



export function unsupportedSkills(evidence = []) {


  return evidence

    .filter(
      x => !x.supported
    )

    .map(
      x => x.skill
    );

}



export function evidenceCount(skill,evidence = []) {


  const found =

    evidence.find(

      x => skillMatch(
        x.skill,
        skill
      )

    );



  return found
    ? found.evidence.length
    : 0;

}