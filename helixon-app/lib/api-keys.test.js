import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/customer-auth", () => ({ agencyHasActiveSubscription: async () => true }));
vi.mock("@/lib/agency-controls", () => ({ getAgencyControls: async () => ({ suspended: false }) }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => true }));

const { generateApiKey, hashApiKey, readApiKey } = await import("@/lib/api-keys");

describe("api keys", () => {
  it("makes a key whose hash and prefix match", () => {
    const k = generateApiKey();
    expect(k.key.startsWith("hx_")).toBe(true);
    expect(k.key.length).toBeGreaterThan(30);
    expect(k.prefix).toBe(k.key.slice(0, 10));
    expect(k.hash).toBe(hashApiKey(k.key));
    expect(generateApiKey().key).not.toBe(k.key);
  });
  it("reads a bearer token or X-API-Key header, and nothing else", () => {
    const key = generateApiKey().key;
    expect(readApiKey(new Headers({ authorization: `Bearer ${key}` }))).toBe(key);
    expect(readApiKey(new Headers({ "x-api-key": key }))).toBe(key);
    // Another service's token shape isn't taken for ours.
    expect(readApiKey(new Headers({ authorization: `Bearer ${"other_" + "x".repeat(30)}` }))).toBeNull();
    expect(readApiKey(new Headers())).toBeNull();
  });
});
