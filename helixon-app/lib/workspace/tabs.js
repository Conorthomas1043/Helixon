// Workspace tabs: the records a recruiter has open (candidates, jobs,
// clients, shortlists), shown as a strip of tabs under the main nav
// (components/workspace/WorkspaceTabs.jsx). Pure functions over a plain
// array, so the rules are tested here and the browser storage lives in
// lib/hooks/useWorkspaceTabs.js.
//
// Tabs keep the order they were opened in, like browser tabs. Opening one
// that's already there refreshes its title instead of adding a second. Past
// MAX_TABS, the one opened longest ago is closed.

export const MAX_TABS = 12;

/** @typedef {"candidate" | "job" | "client" | "shortlist"} TabKind */
/** @typedef {{ kind: TabKind, id: string, title: string, openedAt: number }} WorkspaceTab */

export const TAB_KINDS = /** @type {const} */ ({
  candidate: { label: "Candidate", icon: "users", base: "/dashboard/candidates" },
  job: { label: "Job", icon: "briefcase", base: "/dashboard/jobs" },
  client: { label: "Client", icon: "box", base: "/dashboard/clients" },
  shortlist: { label: "Shortlist", icon: "clipboard", base: "/dashboard/shortlists" },
});

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TITLE = 80;

/** @param {{ kind: string, id: string }} tab */
export const tabKey = (tab) => `${tab.kind}:${tab.id}`;

/** @param {WorkspaceTab} tab */
export const tabHref = (tab) => `${TAB_KINDS[tab.kind].base}/${tab.id}`;

/** @param {unknown} kind @returns {kind is TabKind} */
const isKind = (kind) => typeof kind === "string" && Object.prototype.hasOwnProperty.call(TAB_KINDS, kind);

/** @param {TabKind} kind @param {unknown} title */
function cleanTitle(kind, title) {
  const text = typeof title === "string" ? title.replace(/\s+/g, " ").trim() : "";
  return (text || TAB_KINDS[kind].label).slice(0, MAX_TITLE);
}

/**
 * Opens (or refreshes) a tab.
 * @param {WorkspaceTab[]} tabs
 * @param {{ kind: string, id: string, title?: string }} tab
 * @param {number} [now]
 * @returns {WorkspaceTab[]}
 */
export function openTab(tabs, { kind, id, title }, now = Date.now()) {
  if (!isKind(kind) || typeof id !== "string" || !ID.test(id)) return tabs;
  const key = tabKey({ kind, id });
  const name = cleanTitle(kind, title);
  if (tabs.some((t) => tabKey(t) === key)) {
    return tabs.map((t) => (tabKey(t) === key ? { ...t, title: name, openedAt: now } : t));
  }
  let next = [...tabs, { kind, id, title: name, openedAt: now }];
  while (next.length > MAX_TABS) {
    const oldest = next.reduce((a, b) => (b.openedAt < a.openedAt ? b : a));
    next = next.filter((t) => t !== oldest);
  }
  return next;
}

/** @param {WorkspaceTab[]} tabs @param {string} key */
export function closeTab(tabs, key) {
  return tabs.filter((t) => tabKey(t) !== key);
}

/**
 * Where to go after closing `key`: the tab to its right, else its left,
 * else null (no tabs left).
 * @param {WorkspaceTab[]} tabs @param {string} key
 */
export function neighbourAfterClose(tabs, key) {
  const i = tabs.findIndex((t) => tabKey(t) === key);
  if (i === -1) return null;
  return tabs[i + 1] ?? tabs[i - 1] ?? null;
}

/**
 * The tab a page is showing, from its path ("/dashboard/jobs/abc" ->
 * "job:abc"), or null.
 * @param {string | null | undefined} pathname
 */
export function tabKeyForPath(pathname) {
  for (const [kind, { base }] of Object.entries(TAB_KINDS)) {
    const m = (pathname || "").match(new RegExp(`^${base}/([^/?#]+)/?$`));
    if (m && ID.test(m[1])) return `${kind}:${m[1]}`;
  }
  return null;
}

/**
 * Tabs read back from storage: anything malformed is dropped.
 * @param {string | null | undefined} raw
 * @returns {WorkspaceTab[]}
 */
export function parseStoredTabs(raw) {
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  /** @type {WorkspaceTab[]} */
  let tabs = [];
  for (const t of data) {
    if (!t || typeof t !== "object") continue;
    tabs = openTab(tabs, t, Number.isFinite(t.openedAt) ? t.openedAt : 0);
  }
  return tabs;
}
