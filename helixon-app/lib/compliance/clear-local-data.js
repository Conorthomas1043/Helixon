// Candidate-related data this app keeps in the browser (recent analyses,
// recently viewed candidates, the search box's recently opened candidates,
// jobs and clients - components/dashboard/NavTools.jsx - and the workspace
// tabs, which carry candidates' names). Removed on log out so the next
// person on a shared computer doesn't inherit it.
const KEYS = ["analysisHistory", "helixon:recently-viewed-candidates", "feedbackCount", "helixon.recent"];
// Workspace tabs are stored per user: lib/hooks/useWorkspaceTabs.js.
const PREFIXES = ["helixon:workspace-tabs:"];

export function clearLocalCandidateData() {
  if (typeof window === "undefined") return;
  try {
    KEYS.forEach((k) => window.localStorage.removeItem(k));
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && PREFIXES.some((p) => k.startsWith(p))) window.localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked - nothing stored, nothing to clear.
  }
}
