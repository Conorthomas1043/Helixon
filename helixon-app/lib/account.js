// Shared account-settings data helpers.
//
// Swap useAgencyId() for a real session/context lookup once auth lands —
// every page reads through this hook, so nothing else needs to change.

const AGENCY_ID = "YOUR-SEED-AGENCY-ID";

export function useAgencyId() {
  return AGENCY_ID;
}

// Colours that aren't already CSS custom properties (--forest, --mint, etc.)
// collected once instead of repeated as magic hex strings across pages.
export const COLORS = {
  ink: "#13201b",
  muted: "#5a7a6a",
  faint: "#8aaa9a",
  dangerText: "#dc2626",
  dangerTextDark: "#b91c1c",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
};

export const GENERIC_ERROR = "Something went wrong. Please try again.";

// Detects non-2xx responses, parses a safe error message when the backend
// provides one, and otherwise falls back to a generic message so backend
// internals never reach the UI.
export async function apiRequest(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body — fine for empty success responses.
  }

  if (!res.ok || (data && data.ok === false)) {
    const message =
      data && typeof data.error === "string" && data.error.length > 0 && data.error.length < 200
        ? data.error
        : GENERIC_ERROR;
    throw new Error(message);
  }

  return data;
}