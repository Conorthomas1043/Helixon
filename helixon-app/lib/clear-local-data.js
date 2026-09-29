// Candidate-related data this app keeps in the browser (recent analyses,
// recently viewed candidates). Removed on log out so the next person on a
// shared computer doesn't inherit it.
const KEYS = ["analysisHistory", "helixon:recently-viewed-candidates", "feedbackCount"];

export function clearLocalCandidateData() {
  if (typeof window === "undefined") return;
  try {
    KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Storage blocked - nothing stored, nothing to clear.
  }
}
