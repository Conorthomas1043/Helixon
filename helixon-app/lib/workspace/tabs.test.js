import { describe, expect, it } from "vitest";
import { MAX_TABS, closeTab, neighbourAfterClose, openTab, parseStoredTabs, tabHref, tabKey, tabKeyForPath } from "./tabs";

const cand = (id, title = `Person ${id}`) => ({ kind: "candidate", id, title });

describe("workspace tabs", () => {
  it("adds tabs in the order they're opened", () => {
    let tabs = openTab([], cand("a"), 1);
    tabs = openTab(tabs, { kind: "job", id: "j1", title: "Data Engineer" }, 2);
    expect(tabs.map(tabKey)).toEqual(["candidate:a", "job:j1"]);
    expect(tabHref(tabs[1])).toBe("/dashboard/jobs/j1");
  });

  it("opening one that's already there refreshes it instead of adding a second", () => {
    let tabs = openTab([], cand("a", "Old name"), 1);
    tabs = openTab(tabs, cand("b"), 2);
    tabs = openTab(tabs, cand("a", "New name"), 3);
    expect(tabs.map(tabKey)).toEqual(["candidate:a", "candidate:b"]);
    expect(tabs[0]).toMatchObject({ title: "New name", openedAt: 3 });
  });

  it(`keeps at most ${MAX_TABS}, closing the one opened longest ago`, () => {
    let tabs = [];
    for (let i = 0; i < MAX_TABS; i++) tabs = openTab(tabs, cand(`c${i}`), i + 10);
    tabs = openTab(tabs, cand("c0"), 100); // revisited: now the most recent
    tabs = openTab(tabs, cand("new"), 101);
    expect(tabs).toHaveLength(MAX_TABS);
    expect(tabs.map(tabKey)).not.toContain("candidate:c1");
    expect(tabs.map(tabKey)).toContain("candidate:c0");
  });

  it("ignores unknown kinds and odd ids, and tidies titles", () => {
    expect(openTab([], { kind: "invoice", id: "x" })).toEqual([]);
    expect(openTab([], { kind: "candidate", id: "../etc" })).toEqual([]);
    expect(openTab([], { kind: "candidate", id: "a", title: "  Jane \n Doe  " }, 1)[0].title).toBe("Jane Doe");
    expect(openTab([], { kind: "client", id: "a", title: "" }, 1)[0].title).toBe("Client");
    expect(openTab([], { kind: "job", id: "a", title: "x".repeat(200) }, 1)[0].title).toHaveLength(80);
  });

  it("closing moves to the tab on the right, else the left", () => {
    const tabs = [cand("a"), cand("b"), cand("c")].reduce((t, c, i) => openTab(t, c, i), []);
    expect(tabKey(neighbourAfterClose(tabs, "candidate:b"))).toBe("candidate:c");
    expect(tabKey(neighbourAfterClose(tabs, "candidate:c"))).toBe("candidate:b");
    expect(neighbourAfterClose(closeTab(closeTab(tabs, "candidate:a"), "candidate:b"), "candidate:c")).toBeNull();
    expect(closeTab(tabs, "candidate:b").map(tabKey)).toEqual(["candidate:a", "candidate:c"]);
  });

  it("knows which tab a page is", () => {
    expect(tabKeyForPath("/dashboard/candidates/abc-123")).toBe("candidate:abc-123");
    expect(tabKeyForPath("/dashboard/shortlists/s1/")).toBe("shortlist:s1");
    expect(tabKeyForPath("/dashboard/shortlists/s1/client-pack")).toBeNull();
    expect(tabKeyForPath("/dashboard/candidates")).toBeNull();
    expect(tabKeyForPath(null)).toBeNull();
  });

  it("reads storage defensively", () => {
    expect(parseStoredTabs(null)).toEqual([]);
    expect(parseStoredTabs("not json")).toEqual([]);
    expect(parseStoredTabs('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([cand("a"), { kind: "nope", id: "x" }, null, { kind: "job", id: "j", title: "Role", openedAt: 5 }]);
    expect(parseStoredTabs(raw).map(tabKey)).toEqual(["candidate:a", "job:j"]);
  });
});
