// lib/scoreBands.js
// Maps a numeric match_score to a display band. Kept separate from the
// scoring logic itself (cv-analysis.js) so the UI's band cutoffs can be
// tuned independently of how the score is calculated.
//
// Bands align with the pass/fail thresholds used in Helixon V7 validation:
//   85+      → Excellent Match
//   65–84    → Good Match
//   45–64    → Worth Reviewing
//   below 45 → Weak Match

export function getScoreBand(matchScore) {
  const score = Math.round(Number(matchScore) || 0);

  if (score >= 85) {
    return { band: "Excellent Match", color: "green", min: 85, max: 100 };
  }
  if (score >= 65) {
    return { band: "Good Match", color: "lime", min: 65, max: 84 };
  }
  if (score >= 45) {
    return { band: "Worth Reviewing", color: "amber", min: 45, max: 64 };
  }
  return { band: "Weak Match", color: "red", min: 0, max: 44 };
}