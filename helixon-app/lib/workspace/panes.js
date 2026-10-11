// The split view's layout (app/dashboard/workspace): which candidates are
// open side by side and what each pane shows. It lives in the address,
//   /dashboard/workspace?open=<id>,<id>:cv,<id>:profile
// so a layout can be bookmarked, reloaded or sent to a teammate. A pane
// with no ":view" shows the screening report.

export const MAX_PANES = 4;
export const PANE_VIEWS = /** @type {const} */ (["score", "cv", "profile"]);
export const PANE_VIEW_LABELS = { score: "Score", cv: "CV", profile: "Profile" };

/** @typedef {"score" | "cv" | "profile"} PaneView */
/** @typedef {{ id: string, view: PaneView }} Pane */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** @param {unknown} view @returns {view is PaneView} */
const isView = (view) => typeof view === "string" && /** @type {readonly string[]} */ (PANE_VIEWS).includes(view);

/**
 * The panes in an ?open= value: valid ids only, each candidate once, at most
 * MAX_PANES.
 * @param {string | null | undefined} value
 * @returns {Pane[]}
 */
export function parsePanes(value) {
  /** @type {Pane[]} */
  const panes = [];
  for (const part of String(value || "").split(",")) {
    const [id, view] = part.trim().split(":");
    if (!id || !ID.test(id) || panes.some((p) => p.id === id)) continue;
    panes.push({ id, view: isView(view) ? view : "score" });
    if (panes.length >= MAX_PANES) break;
  }
  return panes;
}

/** @param {Pane[]} panes */
export function serializePanes(panes) {
  return panes.map((p) => (p.view === "score" ? p.id : `${p.id}:${p.view}`)).join(",");
}

/**
 * The split view for these candidates (ids or panes), first MAX_PANES only.
 * @param {(string | Pane)[]} items
 */
export function splitViewHref(items) {
  const panes = parsePanes(items.map((i) => (typeof i === "string" ? i : serializePanes([i]))).join(","));
  return panes.length ? `/dashboard/workspace?open=${serializePanes(panes)}` : "/dashboard/workspace";
}

/** @param {Pane[]} panes @param {string} id @param {PaneView} [view] */
export function addPane(panes, id, view = "score") {
  if (!ID.test(id) || panes.length >= MAX_PANES || panes.some((p) => p.id === id)) return panes;
  return [...panes, { id, view: isView(view) ? view : "score" }];
}

/** @param {Pane[]} panes @param {string} id */
export function removePane(panes, id) {
  return panes.filter((p) => p.id !== id);
}

/** @param {Pane[]} panes @param {string} id @param {PaneView} view */
export function setPaneView(panes, id, view) {
  if (!isView(view)) return panes;
  return panes.map((p) => (p.id === id ? { ...p, view } : p));
}

/**
 * The grid for n panes: two halves, three columns, or two by two. On a
 * phone everything stacks.
 * @param {number} n
 */
export function paneGridClass(n) {
  if (n >= 4) return "grid-cols-1 lg:grid-cols-2 lg:grid-rows-2";
  if (n === 3) return "grid-cols-1 lg:grid-cols-3 lg:grid-rows-1";
  if (n === 2) return "grid-cols-1 lg:grid-cols-2 lg:grid-rows-1";
  return "grid-cols-1 lg:grid-rows-1";
}
