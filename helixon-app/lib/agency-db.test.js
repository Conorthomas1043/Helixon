import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const profileLookup = vi.fn();
const serviceClient = {
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: profileLookup }) }) })),
};

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
vi.mock("@/lib/supabase", () => ({ supabase: serviceClient }));

const { agencyDb, signAgencyToken, _clearAgencyDbCache } = await import("./agency-db");

const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

describe("signAgencyToken", () => {
  it("signs an HS256 token for the agency_member role with the agency id", () => {
    const token = signAgencyToken({ agencyId: "agency-1", userId: "user_1", secret: "s3cret", now: 1_700_000_000_000 });
    const [h, p, sig] = token.split(".");
    expect(decode(h)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decode(p)).toMatchObject({ role: "agency_member", agency_id: "agency-1", sub: "user_1", iat: 1_700_000_000, exp: 1_700_000_300 });
    expect(sig).toBe(crypto.createHmac("sha256", "s3cret").update(`${h}.${p}`).digest("base64url"));
  });
});

describe("agencyDb", () => {
  beforeEach(() => {
    _clearAgencyDbCache();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
  });
  afterEach(() => {
    delete process.env.SUPABASE_AGENCY_RLS;
    delete process.env.SUPABASE_JWT_SECRET;
  });

  it("is the service-role client while switched off", async () => {
    expect(await agencyDb()).toBe(serviceClient);
    process.env.SUPABASE_AGENCY_RLS = "1"; // but no secret: still off
    expect(await agencyDb()).toBe(serviceClient);
    expect(authMock).not.toHaveBeenCalled();
  });

  describe("switched on", () => {
    beforeEach(() => {
      process.env.SUPABASE_AGENCY_RLS = "1";
      process.env.SUPABASE_JWT_SECRET = "s3cret";
    });

    it("returns a separate client scoped to the member's agency, reused briefly", async () => {
      authMock.mockResolvedValue({ userId: "user_1" });
      profileLookup.mockResolvedValue({ data: { agency_id: "agency-1" }, error: null });
      const db = await agencyDb();
      expect(db).not.toBe(serviceClient);
      expect(await agencyDb()).toBe(db);
      expect(profileLookup).toHaveBeenCalledTimes(1);
    });

    it("fails closed without a signed-in member or an agency", async () => {
      authMock.mockResolvedValue({ userId: null });
      await expect(agencyDb()).rejects.toThrow(/signed-in/);
      authMock.mockResolvedValue({ userId: "user_2" });
      profileLookup.mockResolvedValue({ data: { agency_id: null }, error: null });
      await expect(agencyDb()).rejects.toThrow(/no agency/);
    });
  });
});
