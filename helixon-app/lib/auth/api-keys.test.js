import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ key: null, owner: null, admin: true }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table) => {
      const q = { select: () => q, eq: () => q, update: () => q, maybeSingle: async () => ({ data: table === "api_keys" ? db.key : db.owner }) };
      return q;
    },
  },
}));
vi.mock("@/lib/agency/workspace-admin", () => ({ canManageWorkspace: async () => db.admin }));
vi.mock("@/lib/auth/customer-auth", () => ({ agencyHasActiveSubscription: async () => true }));
vi.mock("@/lib/agency/controls", () => ({ getAgencyControls: async () => ({ suspended: false }) }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => true }));

const { _clearApiKeyCache, authenticateApiKey, generateApiKey, hashApiKey, readApiKey } = await import("@/lib/auth/api-keys");

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

  it("stops working once its maker is no longer an admin", async () => {
    const { key } = generateApiKey();
    const request = new Request("https://x.test/api/v1", { headers: { authorization: `Bearer ${key}` } });
    db.key = { id: "k1", agency_id: "a1", name: "Zapier", created_by: "user_1", revoked_at: null, last_used_at: new Date().toISOString() };
    db.owner = { clerk_user_id: "user_1", first_name: "Ana", agency_id: "a1" };
    db.admin = true;
    _clearApiKeyCache();
    expect(await authenticateApiKey(request)).toMatchObject({ ok: true, agencyId: "a1" });
    db.admin = false;
    _clearApiKeyCache();
    expect(await authenticateApiKey(request)).toMatchObject({ ok: false, status: 403 });
  });
});
