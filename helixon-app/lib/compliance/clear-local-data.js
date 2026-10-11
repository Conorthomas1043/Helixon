// Candidate-related data this app keeps in the browser (recent analyses,
// recently viewed candidates, the search box's recently opened candidates,
// jobs and clients - components/dashboard/NavTools.jsx - and the workspace
// tabs, which carry candidates' names). Removed on log out so the next
// person on a shared computer doesn't inherit it.
const KEYS = ["analysisHistory", "helixon:recently-viewed-candidates", "feedbackCount", "helixon.recent"];
// Workspace tabs are stored per user (lib/hooks/useWorkspaceTabs.js); note
// drafts and tab scroll positions per candidate, for the session.
const PREFIXES = ["helixon:workspace-tabs:", "helixon:note-draft:", "helixon:tab-scroll:"];

export function clearLocalCandidateData() {
  if (typeof window === "undefined") return;
  try {
    KEYS.forEach((k) => window.localStorage.removeItem(k));
    for (const store of [window.localStorage, window.sessionStorage]) {
      if (!store) continue;
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i);
        if (k && PREFIXES.some((p) => k.startsWith(p))) store.removeItem(k);
      }
    }
    // The "has tabs" hint (lib/hooks/useWorkspaceTabs.js).
    if (typeof document !== "undefined") document.cookie = "helixon_ws_tabs=; path=/; max-age=0; samesite=lax";
  } catch {
    // Storage blocked - nothing stored, nothing to clear.
  }
}
