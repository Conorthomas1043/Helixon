const METRIC_REGEX =
/(\d+(%| percent| million| billion|k\b| users| requests| revenue| customers| clients| accounts| patients| staff| people| students| sites| stores| orders| calls| units| beds| pallets| deliveries| drops| covers| rooms| vehicles| homes| residents| picks| cases| lines| per hour| an hour| a day)|[£$€]\s?\d)/ig;


const IMPACT_WORDS = [
  "increased", "reduced", "saved", "optimised", "optimized", "improved",
  "cut", "grew", "boosted", "accelerated", "delivered", "exceeded",
  "achieved", "won", "generated", "doubled", "tripled", "halved",
  "awarded", "promoted", "ranked", "top performer", "record",
  "employee of the month", "employee of the year", "key holder", "keyholder",
  "trusted", "commended", "praised", "zero accidents", "100% attendance",
  "clean licence", "clean driving licence"
]


// Whole-word - as substrings, "cut" matched "executive" and "won"
// matched "wonderful".
const IMPACT_RE = new RegExp(`\\b(${IMPACT_WORDS.join("|")})\\b`);


function normaliseCV(cv = "") {


  if (typeof cv === "string") {

    return cv;

  }


  if (cv?.text) {

    return cv.text;

  }


  if (cv?.raw) {

    return cv.raw;

  }


  if (cv?.content) {

    return cv.content;

  }


  return "";

}



export function extractAchievements(cv = "") {


  cv = normaliseCV(cv);


  const lines =
    cv
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);



  const achievements = [];


  for (const line of lines) {


    const metric =
      line.match(METRIC_REGEX);



    const impact =
      IMPACT_RE.test(line.toLowerCase());



    if (metric || impact) {


      achievements.push({

        text: line,

        quantified: Boolean(metric),

        impact

      });


    }


  }


  return achievements;

}



