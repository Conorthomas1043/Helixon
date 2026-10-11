// Which optional columns a list shows - chosen per person with the
// "Columns" menu and remembered in this browser.

export const CANDIDATE_COLUMNS = [
  { key: "skills", label: "Skills", default: true },
  { key: "recruiter", label: "Recruiter", default: true },
  { key: "stage", label: "Stage", default: true },
  { key: "nextAction", label: "Next action", default: true },
  { key: "currentRole", label: "Current role", default: false },
  { key: "source", label: "Source", default: false },
  { key: "lastActivity", label: "Last activity", default: false },
  { key: "added", label: "Added", default: false },
  { key: "score", label: "Score", default: true },
];

export function defaultColumns(columns) {
  return columns.filter((c) => c.default).map((c) => c.key);
}

// A saved choice, keeping only columns that still exist; the defaults when
// nothing (or nothing usable) is saved.
export function parseColumns(raw, columns) {
  try {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return defaultColumns(columns);
    const known = new Set(columns.map((c) => c.key));
    const keys = saved.filter((k) => typeof k === "string" && known.has(k));
    return keys.length ? [...new Set(keys)] : defaultColumns(columns);
  } catch {
    return defaultColumns(columns);
  }
}

export function readColumns(storageKey, columns) {
  try {
    return parseColumns(window.localStorage.getItem(storageKey), columns);
  } catch {
    return defaultColumns(columns);
  }
}

export function writeColumns(storageKey, keys) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    // Storage blocked - the choice lasts until the page is reloaded.
  }
}
