// lib/scoreBands.js
// The one place match-score cut-offs live. Every label, colour, bucket and
// recommendation derived from a match_score imports these, so a score can't
// read "Worth reviewing" in one place and "Weak match" in another. (They
// had drifted to three different sets: the recommendation used 80/55, this
// file 85/65/45, and the dashboard and analyse UI 80/60.)
//
//   80+    → strong match
//   60–79  → worth reviewing
//   <60    → weak match

export const STRONG_MATCH_MIN = 80;

export const REVIEW_MIN = 60;

// The one set of words for the score bands, used everywhere a band is
// named. There were five ("Strong Match", "Worth Reviewing", "Moderate
// match", "Moderate", "Review"...), which breaks Nielsen's consistency
// heuristic (Nielsen, 1994, "Enhancing the explanatory power of usability heuristics", Proc. CHI '94): people can't tell
// whether "Moderate" and "Worth reviewing" are the same thing.
export const BAND_LABELS = { strong: "Strong match", review: "Worth reviewing", weak: "Weak match" };

export function scoreBandLabel(matchScore) {
  if (matchScore === null || matchScore === undefined) return "No score";
  const score = Math.round(Number(matchScore) || 0);
  if (score >= STRONG_MATCH_MIN) return BAND_LABELS.strong;
  if (score >= REVIEW_MIN) return BAND_LABELS.review;
  return BAND_LABELS.weak;
}

export function getScoreBand(matchScore) {
  const score = Math.round(Number(matchScore) || 0);

  if (score >= STRONG_MATCH_MIN) {
    return { band: BAND_LABELS.strong, color: "green", min: STRONG_MATCH_MIN, max: 100 };
  }
  if (score >= REVIEW_MIN) {
    return { band: BAND_LABELS.review, color: "amber", min: REVIEW_MIN, max: STRONG_MATCH_MIN - 1 };
  }
  return { band: BAND_LABELS.weak, color: "red", min: 0, max: REVIEW_MIN - 1 };
}
