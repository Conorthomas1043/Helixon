import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ attempts: [], fail: false, redisAllows: true }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const filters = [];
      const q = {
        select: () => q,
        eq: (col, v) => (filters.push((r) => r[col] === v), q),
        gte: () => q,
        then: (resolve) =>
          resolve(db.fail ? { count: null, error: { message: "db down" } } : { count: db.attempts.filter((r) => filters.every((f) => f(r))).length, error: null }),
      };
      return q;
    },
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/ops/site-settings", () => ({ isFeatureEnabled: async () => true }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => db.redisAllows }));

const { checkEmployeeRateLimit, sessionTokenHash } = await import("./auth");

const fail = (username, ip, n) => {
  for (let i = 0; i < n; i++) db.attempts.push({ login_type: "employee", success: false, username, ip });
};

beforeEach(() => {
  db.attempts = [];
  db.fail = false;
  db.redisAllows = true;
});

describe("staff login limits", () => {
  it("pauses the address guessing at a username, not the employee everywhere", async () => {
    fail("ana", "1.1.1.1", 5);
    expect((await checkEmployeeRateLimit("ana", "1.1.1.1")).blocked).toBe(true);
    expect((await checkEmployeeRateLimit("ana", "2.2.2.2")).blocked).toBe(false);
  });

  it("still stops a guess spread over many addresses, and one address trying many names", async () => {
    for (let i = 0; i < 50; i++) fail("ana", `10.0.0.${i}`, 1);
    expect((await checkEmployeeRateLimit("ana", "2.2.2.2")).blocked).toBe(true);
    db.attempts = [];
    for (let i = 0; i < 20; i++) fail(`user${i}`, "3.3.3.3", 1);
    expect((await checkEmployeeRateLimit("bob", "3.3.3.3")).blocked).toBe(true);
  });

  it("falls back to the Redis limiter instead of allowing everything", async () => {
    db.fail = true;
    expect((await checkEmployeeRateLimit("ana", "1.1.1.1")).blocked).toBe(false);
    db.redisAllows = false;
    expect((await checkEmployeeRateLimit("ana", "1.1.1.1")).blocked).toBe(true);
  });

  it("stores session tokens only as a hash", () => {
    const hash = sessionTokenHash("abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe("abc");
    expect(sessionTokenHash("abc")).toBe(hash);
  });
});
