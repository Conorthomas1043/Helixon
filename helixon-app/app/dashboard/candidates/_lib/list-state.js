// The candidate list's state (app/dashboard/candidates/CandidateList.jsx) as
// one reducer: the filters and the two text boxes that feed them, the loaded
// page and its loading status, the ticked rows, and the busy and error state
// of the bulk actions and the export. Each change is a named action, so the
// rules (a new filter goes back to page 1; a fresh page clears the ticks) live
// here, with tests, instead of across nineteen setters.

import { DEFAULT_FILTERS } from "@/lib/candidates/list-params";

/**
 * @param {import("@/lib/candidates/list-params").CandidateFilters} filters from the address bar
 * @param {{ result: any, stageCounts: any } | null} initialData loaded on the server, if it was
 */
export function initialListState(filters, initialData) {
  return {
    filters,
    searchInput: filters.search,
    nearInput: filters.near,
    data: initialData,
    status: initialData ? "ready" : "loading",
    errorMessage: "",
    reloadKey: 0,
    selectedIds: new Set(),
    bulkBusy: false,
    bulkError: "",
    bulkNotice: "",
    exporting: false,
    exportError: "",
  };
}

const firstPage = (filters) => ({ ...filters, page: 1 });

export function listReducer(state, action) {
  switch (action.type) {
    // ── Filters ────────────────────────────────────────────────────────────
    case "filter":
      return { ...state, filters: firstPage({ ...state.filters, ...action.patch }) };
    case "page":
      return { ...state, filters: { ...state.filters, page: action.page } };
    case "typeSearch":
      return { ...state, searchInput: action.value };
    case "typeNear":
      return { ...state, nearInput: action.value };
    // The search box, after its debounce: a no-op when nothing changed, so
    // the list isn't reloaded or sent back to page 1.
    case "commitSearch":
      return state.filters.search === state.searchInput ? state : { ...state, filters: firstPage({ ...state.filters, search: state.searchInput }) };
    case "toggleTag": {
      const { tagIds } = state.filters;
      const next = tagIds.includes(action.tagId) ? tagIds.filter((t) => t !== action.tagId) : [...tagIds, action.tagId];
      return { ...state, filters: firstPage({ ...state.filters, tagIds: next }) };
    }
    case "tagDeleted":
      return state.filters.tagIds.includes(action.tagId)
        ? { ...state, filters: firstPage({ ...state.filters, tagIds: state.filters.tagIds.filter((t) => t !== action.tagId) }) }
        : state;
    // A saved search: its filters, and its text in the two boxes.
    case "applySaved":
      return { ...state, filters: action.filters, searchInput: action.filters.search, nearInput: action.filters.near };
    case "clearFilters":
      return { ...state, searchInput: "", nearInput: "", filters: DEFAULT_FILTERS };

    // ── Loading ────────────────────────────────────────────────────────────
    // A refresh keeps the current page on screen; only a first load shows
    // the skeleton.
    case "loading":
      return state.status === "ready" ? state : { ...state, status: "loading" };
    case "loaded":
      return { ...state, data: action.data, status: "ready", selectedIds: new Set() };
    case "failed":
      return { ...state, status: "error", errorMessage: action.message || "" };
    case "retry":
      return { ...state, status: "loading", reloadKey: state.reloadKey + 1 };

    // ── Selection ──────────────────────────────────────────────────────────
    case "toggleSelect": {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedIds: next };
    }
    case "toggleSelectAll": {
      const items = state.data?.result?.items ?? [];
      if (!items.length) return state;
      const all = items.every((c) => state.selectedIds.has(c.id));
      return { ...state, selectedIds: all ? new Set() : new Set(items.map((c) => c.id)) };
    }
    case "clearSelection":
      return { ...state, selectedIds: new Set() };

    // ── Bulk actions and export ────────────────────────────────────────────
    case "bulkStart":
      return { ...state, bulkBusy: true, bulkError: "" };
    case "bulkFailed":
      return { ...state, bulkError: action.message };
    // Whatever happened, reload: some rows may have changed.
    case "bulkDone":
      return { ...state, bulkBusy: false, status: "loading", reloadKey: state.reloadKey + 1 };
    case "bulkNotice":
      return { ...state, bulkNotice: action.message };
    case "exportStart":
      return { ...state, exporting: true, exportError: "" };
    case "exportFailed":
      return { ...state, exportError: action.message };
    case "exportDone":
      return { ...state, exporting: false };
    default:
      throw new Error(`Unknown candidate list action: ${action.type}`);
  }
}

/** How many filters (beyond the search box) narrow the list. */
export function activeFilterCount(filters) {
  return (
    ["stage", "scoreBand", "status", "recruiterId", "jobId", "dateRange"].filter((k) => filters[k] !== "all").length +
    (filters.tagIds.length > 0 ? 1 : 0) +
    (filters.pool ? 1 : 0) +
    (filters.near ? 1 : 0)
  );
}
