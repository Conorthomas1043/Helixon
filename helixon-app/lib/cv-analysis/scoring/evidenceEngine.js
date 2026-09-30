import { skillMatch, containsPhrase, normaliseSkill } from "../utils/skillNormaliser.js";


// Verbs that show the candidate doing the work, not just listing it.
// Spans professions - it used to be engineering verbs only (built,
// deployed, architected...), so a sales CV's "exceeded quota" or a care
// CV's "supported residents" never counted as strong evidence.
const HIGH_CONFIDENCE = [
  "built", "developed", "implemented", "designed", "architected", "created",
  "deployed", "maintained", "migrated", "owned", "led", "managed",
  "delivered", "achieved", "exceeded", "grew", "increased", "reduced",
  "improved", "launched", "established", "introduced", "won", "closed",
  "sold", "negotiated", "generated", "secured", "trained", "coached",
  "mentored", "supervised", "coordinated", "organised", "organized",
  "ran", "oversaw", "handled", "resolved", "administered", "prepared",
  "processed", "produced", "supported", "cared", "treated", "assessed",
  "taught", "planned", "operated", "installed", "repaired", "inspected",
  "recruited", "audited", "reconciled", "drafted",
  "picked", "packed", "loaded", "unloaded", "drove", "cleaned", "cooked",
  "served", "stocked", "assembled", "fitted", "welded", "patrolled",
  "monitored", "prepped", "replenished", "dispatched", "fixed", "wired",
  "plastered", "decorated", "laid", "checked", "cared",
  "wrote", "programmed", "coded", "scripted", "automated", "tested"
]



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


// A line that only lists skills ("Skills: Python, SQL, AWS") shows the
// candidate named the skill, not that they used it. Before this, any line
// mentioning a skill counted as evidence - including the skills list the
// skill was extracted from - so almost nothing was ever "unsupported" and
// the confidence and risk penalties for unsupported skills never fired.
const LIST_HEADING_RE = /^[\s•·*\-–]*(key |core |technical |relevant |professional )?(skills|competencies|technologies|tools|tech stack|expertise|proficiencies|languages|software)\b/i;
const SEPARATORS_RE = /[,|•·;\/]/g;

function isListingLine(line) {
  if (LIST_HEADING_RE.test(line)) return true;
  const separators = (line.match(SEPARATORS_RE) || []).length;
  return separators >= 2 && !HIGH_CONFIDENCE_RE.test(line.toLowerCase());
}

// One- and two-letter skills ("C", "R", "Go") are matched case-sensitively,
// so "go to market" or "grade c" isn't evidence of Go or C.
function lineMentions(line, term) {
  const norm = normaliseSkill(term);
  if (norm.length > 2) return containsPhrase(line, term);
  const escaped = String(term).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9+#])${escaped}($|[^A-Za-z0-9+#])`).test(line);
}

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


      if (!terms.some(term => lineMentions(line, term))) {

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

        confidence,

        listing: isListingLine(line)

      });


    }



    return {


      skill,


      // Supported = at least one line that describes work with the skill
      // (an impact verb, a longer line, or a short sentence of 4+ words)
      // and isn't a list - not just a mention in a skills list or a
      // one-word line.
      supported:
        // A one-letter skill ("C", "R") needs an impact verb on the line -
        // "Grade C in maths" is a sentence, but not evidence.
        matches.some(m => !m.listing && (
          normaliseSkill(skill).length === 1
            ? m.confidence === "High"
            : m.confidence !== "Low" || m.evidence.split(/\s+/).length >= 4
        )),


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