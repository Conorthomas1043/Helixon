import { describe, expect, it } from "vitest";
import { MAX_PANES, addPane, paneGridClass, parsePanes, removePane, serializePanes, setPaneView, splitViewHref } from "./panes";

describe("split view address", () => {
  it("reads ids with an optional view, defaulting to the score", () => {
    expect(parsePanes("a,b:cv,c:profile")).toEqual([
      { id: "a", view: "score" },
      { id: "b", view: "cv" },
      { id: "c", view: "profile" },
    ]);
  });

  it("drops bad ids, repeats and anything past the limit", () => {
    expect(parsePanes("a,a:cv,../x,,b:nonsense")).toEqual([
      { id: "a", view: "score" },
      { id: "b", view: "score" },
    ]);
    expect(parsePanes("a,b,c,d,e,f")).toHaveLength(MAX_PANES);
    expect(parsePanes(null)).toEqual([]);
  });

  it("writes the shortest form back", () => {
    const panes = parsePanes("a,b:cv");
    expect(serializePanes(panes)).toBe("a,b:cv");
    expect(parsePanes(serializePanes(panes))).toEqual(panes);
  });

  it("builds links from ids or panes", () => {
    expect(splitViewHref(["a", "b"])).toBe("/dashboard/workspace?open=a,b");
    expect(splitViewHref([{ id: "a", view: "cv" }, "b", "c", "d", "e"])).toBe("/dashboard/workspace?open=a:cv,b,c,d");
    expect(splitViewHref([])).toBe("/dashboard/workspace");
  });

  it("adds, removes and switches panes", () => {
    let panes = addPane([], "a");
    panes = addPane(panes, "b", "cv");
    expect(addPane(panes, "a")).toBe(panes);
    panes = setPaneView(panes, "a", "profile");
    expect(serializePanes(panes)).toBe("a:profile,b:cv");
    expect(setPaneView(panes, "a", "bogus")).toBe(panes);
    expect(serializePanes(removePane(panes, "a"))).toBe("b:cv");
    const full = ["a", "b", "c", "d"].reduce((p, id) => addPane(p, id), []);
    expect(addPane(full, "e")).toBe(full);
  });

  it("lays out one to four panes", () => {
    expect(paneGridClass(1)).toContain("grid-cols-1");
    expect(paneGridClass(3)).toContain("lg:grid-cols-3");
    expect(paneGridClass(4)).toContain("lg:grid-cols-2");
  });
});
