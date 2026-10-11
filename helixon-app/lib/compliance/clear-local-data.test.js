import { afterEach, describe, expect, it } from "vitest";
import { clearLocalCandidateData } from "./clear-local-data";

function fakeStorage(entries) {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
  };
}

afterEach(() => {
  delete globalThis.window;
});

describe("clearLocalCandidateData", () => {
  it("removes candidate data, every user's workspace tabs, and nothing else", () => {
    const localStorage = fakeStorage({
      analysisHistory: "[]",
      "helixon.recent": "[]",
      "helixon:workspace-tabs:user_a": "[]",
      "helixon:workspace-tabs:user_b": "[]",
      "helixon:interviews-view": "week",
    });
    globalThis.window = { localStorage };
    clearLocalCandidateData();
    expect(localStorage.keys()).toEqual(["helixon:interviews-view"]);
  });
});
