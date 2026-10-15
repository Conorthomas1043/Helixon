import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/lib/candidates/list-params";
import { activeFilterCount, initialListState, listReducer } from "./list-state";

const PAGE = { result: { items: [{ id: "a" }, { id: "b" }] }, stageCounts: { all: 2 } };
const start = (filters = DEFAULT_FILTERS, data = null) => initialListState(filters, data);
const run = (state, ...actions) => actions.reduce(listReducer, state);

describe("candidate list state", () => {
  it("starts ready with server data, loading without", () => {
    expect(start(DEFAULT_FILTERS, PAGE).status).toBe("ready");
    expect(start().status).toBe("loading");
    expect(start({ ...DEFAULT_FILTERS, search: "rust" }).searchInput).toBe("rust");
  });

  it("sends any filter change back to page 1, but not a page change", () => {
    const s = run(start(), { type: "page", page: 4 });
    expect(s.filters.page).toBe(4);
    expect(run(s, { type: "filter", patch: { stage: "Offer" } }).filters).toMatchObject({ stage: "Offer", page: 1 });
    expect(run(s, { type: "toggleTag", tagId: "t1" }).filters).toMatchObject({ tagIds: ["t1"], page: 1 });
  });

  it("commits the search box only when it changed", () => {
    const s = run(start(), { type: "page", page: 3 });
    expect(run(s, { type: "commitSearch" })).toBe(s);
    const typed = run(s, { type: "typeSearch", value: "java" }, { type: "commitSearch" });
    expect(typed.filters).toMatchObject({ search: "java", page: 1 });
  });

  it("toggles a tag on and off, and drops a deleted one", () => {
    const on = run(start(), { type: "toggleTag", tagId: "t1" }, { type: "toggleTag", tagId: "t2" });
    expect(on.filters.tagIds).toEqual(["t1", "t2"]);
    expect(run(on, { type: "toggleTag", tagId: "t1" }).filters.tagIds).toEqual(["t2"]);
    expect(run(on, { type: "tagDeleted", tagId: "t2" }).filters.tagIds).toEqual(["t1"]);
    expect(run(on, { type: "tagDeleted", tagId: "nope" })).toBe(on);
  });

  it("applies a saved search to the filters and both boxes", () => {
    const saved = { ...DEFAULT_FILTERS, search: "nurse", near: "York", stage: "Offer" };
    expect(run(start(), { type: "applySaved", filters: saved })).toMatchObject({ filters: saved, searchInput: "nurse", nearInput: "York" });
  });

  it("clears every filter and both text boxes", () => {
    const s = run(start(), { type: "typeSearch", value: "x" }, { type: "typeNear", value: "LS1" }, { type: "filter", patch: { stage: "Offer" } }, { type: "clearFilters" });
    expect(s).toMatchObject({ searchInput: "", nearInput: "", filters: DEFAULT_FILTERS });
  });

  it("keeps the current page on screen while it refreshes", () => {
    const ready = start(DEFAULT_FILTERS, PAGE);
    expect(run(ready, { type: "loading" })).toBe(ready);
    expect(run(start(), { type: "loading" }).status).toBe("loading");
  });

  it("clears the ticks when a new page arrives, and records a failure", () => {
    const ticked = run(start(DEFAULT_FILTERS, PAGE), { type: "toggleSelect", id: "a" });
    expect([...ticked.selectedIds]).toEqual(["a"]);
    expect(run(ticked, { type: "loaded", data: PAGE }).selectedIds.size).toBe(0);
    expect(run(ticked, { type: "failed", message: "Nope" })).toMatchObject({ status: "error", errorMessage: "Nope" });
  });

  it("selects the whole page, then none", () => {
    const all = run(start(DEFAULT_FILTERS, PAGE), { type: "toggleSelect", id: "a" }, { type: "toggleSelectAll" });
    expect([...all.selectedIds].sort()).toEqual(["a", "b"]);
    expect(run(all, { type: "toggleSelectAll" }).selectedIds.size).toBe(0);
    const empty = start();
    expect(run(empty, { type: "toggleSelectAll" })).toBe(empty);
  });

  it("reloads after a bulk action whether or not it worked", () => {
    const s = run(start(DEFAULT_FILTERS, PAGE), { type: "bulkStart" }, { type: "bulkFailed", message: "No" }, { type: "bulkDone" });
    expect(s).toMatchObject({ bulkBusy: false, bulkError: "No", status: "loading", reloadKey: 1 });
    expect(run(s, { type: "bulkStart" }).bulkError).toBe("");
  });

  it("tracks the export", () => {
    const s = run(start(), { type: "exportStart" }, { type: "exportFailed", message: "Too big" }, { type: "exportDone" });
    expect(s).toMatchObject({ exporting: false, exportError: "Too big" });
  });

  it("refuses an unknown action", () => {
    expect(() => listReducer(start(), { type: "nope" })).toThrow(/Unknown/);
  });

  it("counts the active filters", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, stage: "Offer", tagIds: ["t"], pool: true, near: "LS1", search: "ignored" })).toBe(4);
  });
});
