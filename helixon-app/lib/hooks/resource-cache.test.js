import { describe, expect, it, vi } from "vitest";
import { EMPTY_ENTRY, createResourceCache } from "./resource-cache";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe("resource cache", () => {
  it("starts empty, then holds the answer", async () => {
    const cache = createResourceCache();
    expect(cache.get("jobs")).toBe(EMPTY_ENTRY);
    expect(cache.get(null)).toBe(EMPTY_ENTRY);
    const done = cache.load("jobs", async () => ["a"]);
    expect(cache.get("jobs")).toMatchObject({ loading: true, loaded: false });
    await done;
    expect(cache.get("jobs")).toEqual({ data: ["a"], error: null, loading: false, loaded: true });
  });

  it("tells listeners about every change, with a new snapshot each time", async () => {
    const cache = createResourceCache();
    const seen = [];
    cache.subscribe("k", () => seen.push(cache.get("k")));
    await cache.load("k", async () => 1);
    expect(seen.map((e) => [e.loading, e.data])).toEqual([[true, undefined], [false, 1]]);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("shares a request already in flight for the same key", async () => {
    const cache = createResourceCache();
    const loader = vi.fn(async () => "x");
    await Promise.all([cache.load("k", loader), cache.load("k", loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keeps the latest answer when a forced reload overtakes a slow request", async () => {
    const cache = createResourceCache();
    const slow = deferred();
    const first = cache.load("k", () => slow.promise);
    await cache.load("k", async () => "fresh", { force: true });
    slow.resolve("stale");
    await first;
    expect(cache.get("k").data).toBe("fresh");
  });

  it("keys don't interfere: a late answer for an old key stays on that key", async () => {
    const cache = createResourceCache();
    const slow = deferred();
    const a = cache.load("interviews:mine", () => slow.promise);
    await cache.load("interviews:all", async () => ["all"]);
    slow.resolve(["mine"]);
    await a;
    expect(cache.get("interviews:all").data).toEqual(["all"]);
    expect(cache.get("interviews:mine").data).toEqual(["mine"]);
  });

  it("keeps the last good answer beside an error", async () => {
    const cache = createResourceCache();
    await cache.load("k", async () => "good");
    await cache.load("k", async () => {
      throw new Error("offline");
    }, { force: true });
    expect(cache.get("k")).toMatchObject({ data: "good", loaded: true, loading: false });
    expect(cache.get("k").error.message).toBe("offline");
    // The next success clears it.
    await cache.load("k", async () => "again", { force: true });
    expect(cache.get("k").error).toBeNull();
  });

  it("set() replaces the data, from a value or the previous data", () => {
    const cache = createResourceCache();
    cache.set("k", [1]);
    cache.set("k", (prev) => [...prev, 2]);
    expect(cache.get("k")).toMatchObject({ data: [1, 2], loaded: true });
  });

  it("clear() forgets everything and tells listeners", async () => {
    const cache = createResourceCache();
    const fn = vi.fn();
    await cache.load("k", async () => "secret");
    cache.subscribe("k", fn);
    cache.clear();
    expect(cache.get("k")).toBe(EMPTY_ENTRY);
    expect(fn).toHaveBeenCalled();
  });
});
