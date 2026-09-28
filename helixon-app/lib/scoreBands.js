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

export function getScoreBand(matchScore) {
  const score = Math.round(Number(matchScore) || 0);

  if (score >= STRONG_MATCH_MIN) {
    return { band: "Strong Match", color: "green", min: STRONG_MATCH_MIN, max: 100 };
  }
  if (score >= REVIEW_MIN) {
    return { band: "Worth Reviewing", color: "amber", min: REVIEW_MIN, max: STRONG_MATCH_MIN - 1 };
  }
  return { band: "Weak Match", color: "red", min: 0, max: REVIEW_MIN - 1 };
}
