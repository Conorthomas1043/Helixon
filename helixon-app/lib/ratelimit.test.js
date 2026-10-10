import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map());
vi.mock("@/lib/redis", () => ({
  getRedis: () =>
    Promise.resolve({
      incr: async (k) => store.set(k, (store.get(k) ?? 0) + 1).get(k),
      incrBy: async (k, n) => store.set(k, (store.get(k) ?? 0) + n).get(k),
      decrBy: async (k, n) => store.set(k, (store.get(k) ?? 0) - n).get(k),
      expire: async () => 1,
      set: async (k, v, { NX }) => (NX && store.has(k) ? null : (store.set(k, v), "OK")),
      del: async (k) => (store.delete(k) ? 1 : 0),
    }),
}));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const { rateLimit, acquireLock, releaseLock } = await import("./ratelimit");

beforeEach(() => store.clear());

describe("rateLimit with a cost", () => {
  it("charges one unit per email, not per request", async () => {
    expect(await rateLimit("u1", 400, { cost: 100 })).toBe(true);
    expect(await rateLimit("u1", 400, { cost: 100 })).toBe(true);
    expect(await rateLimit("u1", 400, { cost: 100 })).toBe(true);
    expect(await rateLimit("u1", 400, { cost: 100 })).toBe(true);
    expect(await rateLimit("u1", 400, { cost: 1 })).toBe(false);
  });

  it("refuses a batch that would go over without charging it", async () => {
    expect(await rateLimit("u2", 400, { cost: 350 })).toBe(true);
    expect(await rateLimit("u2", 400, { cost: 100 })).toBe(false);
    expect(await rateLimit("u2", 400, { cost: 50 })).toBe(true);
  });
});

describe("acquireLock", () => {
  it("lets one caller in until it's released", async () => {
    expect(await acquireLock("send:a1")).toBe(true);
    expect(await acquireLock("send:a1")).toBe(false);
    await releaseLock("send:a1");
    expect(await acquireLock("send:a1")).toBe(true);
  });
});
