const METRIC_REGEX =
/\d+(%| percent| million| billion|k\b| users| requests| revenue|£|\$|€)/ig;


const IMPACT_WORDS = [

  "increased",

  "reduced",

  "saved",

  "optimised",

  "improved",

  "cut",

  "grew",

  "boosted",

  "accelerated",

  "delivered"

];


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
      IMPACT_WORDS.some(
        x => line.toLowerCase().includes(x)
      );



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



export function achievementScore(items = []) {


  if (!items.length) {

    return 0;

  }


  let score = 0;


  for (const item of items) {


    score += 5;


    if (item.quantified) {

      score += 5;

    }


    if (item.impact) {

      score += 5;

    }


  }


  return Math.min(score,100);

}