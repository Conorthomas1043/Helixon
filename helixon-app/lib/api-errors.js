// Turns a failed request into words a recruiter can act on. Before this,
// the dashboard showed whatever fetch() threw ("Failed to fetch", "Load
// failed", "NetworkError when attempting to fetch resource.") or, for a
// server error with no JSON body, "Request failed".
//
// A 401 also raises a "signed out" event: the page stays as it is, so
// nothing typed is lost, and DashboardNav offers a way to sign back in.

export const OFFLINE_MESSAGE = "Couldn't reach Helixon. Check your connection and try again.";
export const SIGNED_OUT_MESSAGE = "You've been signed out. Sign in again to save this.";
export const SIGNED_OUT_EVENT = "helixon:signed-out";

// Message for a response that wasn't ok. Prefers the server's own message.
export function responseErrorMessage(status, data) {
  if (status === 401) return SIGNED_OUT_MESSAGE;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  if (status === 403) return "You don't have permission to do that. Ask an admin on your team.";
  if (status === 404) return "That couldn't be found. It may have been deleted.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many requests in a row. Wait a moment and try again.";
  if (status >= 500) return `Something went wrong on our side (error ${status}). Please try again.`;
  return "That didn't work. Please try again.";
}

export function announceSignedOut() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
}
