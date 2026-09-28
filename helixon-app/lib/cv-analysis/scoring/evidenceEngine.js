import { skillMatch, containsPhrase } from "../utils/skillNormaliser.js";


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



// Whole-word, so "led" doesn't fire on "called"/"skilled".
const HIGH_CONFIDENCE_RE = new RegExp(`\\b(${HIGH_CONFIDENCE.join("|")})\\b`);


// searchTerms (optional): Map of skill -> extra wordings to look for. A
// required skill credited through an alias (job says "Kubernetes", CV says
// "K8s") has to be searched for under the candidate's own wording, or it's
// always reported as unsupported even though the CV clearly shows it.
export function collectEvidence(cvText = "", skills = [], searchTerms = new Map()) {


  cvText = normaliseCV(cvText);


  const lines =

    cvText

      .split(/\r?\n/)

      .map(x => x.trim())

      .filter(Boolean);



  return skills.map(skill => {


    const matches = [];

    const terms = [skill, ...(searchTerms.get(skill) || [])];



    for (const line of lines) {


      if (!terms.some(term => containsPhrase(line, term))) {

        continue;

      }


      const lower =
        line.toLowerCase();



      let confidence = "Low";



      if (HIGH_CONFIDENCE_RE.test(lower)) {

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