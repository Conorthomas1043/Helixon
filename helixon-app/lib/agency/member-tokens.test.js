import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const token = "0123456789abcdef0123456789abcdef";
const db = vi.hoisted(() => ({ current: null }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: (t) => db.current.from(t) } }));

const { bccAddress, bccTokenFromAddress, memberForToken, revokeMemberTokens } = await import("./member-tokens");

describe("BCC logging address", () => {
  it("is log+token at the inbound domain", () => {
    expect(bccAddress(token, "in.example.com")).toBe(`log+${token}@in.example.com`);
    expect(bccAddress(token, null)).toBeNull();
  });
  it("reads the token back, only for our domain", () => {
    expect(bccTokenFromAddress(`Helixon <LOG+${token.toUpperCase()}@In.Example.com>`, "in.example.com")).toBe(token);
    expect(bccTokenFromAddress(`log+${token}@other.com`, "in.example.com")).toBeNull();
    expect(bccTokenFromAddress(`reply+${token}@in.example.com`, "in.example.com")).toBeNull();
  });
});

describe("memberForToken", () => {
  const seed = () => ({
    member_tokens: [{ agency_id: "A", user_id: "user_1", purpose: "calendar", token }],
    profiles: [{ id: "p1", clerk_user_id: "user_1", agency_id: "A" }],
  });

  it("finds a current member", async () => {
    db.current = fakeDb(seed());
    expect(await memberForToken(token, "calendar")).toMatchObject({ agency_id: "A", user_id: "user_1" });
  });

  it("stops working while the workspace is suspended", async () => {
    db.current = fakeDb({ ...seed(), agencies: [{ id: "A", suspended_at: "2026-10-01T00:00:00Z" }] });
    expect(await memberForToken(token, "calendar")).toBeNull();
  });

  it("refuses someone who has left the agency", async () => {
    const s = seed();
    s.profiles[0].agency_id = null;
    db.current = fakeDb(s);
    expect(await memberForToken(token, "calendar")).toBeNull();
  });

  it("stops working once the tokens are revoked", async () => {
    db.current = fakeDb(seed());
    await revokeMemberTokens("user_1", "A");
    expect(db.current.tables.member_tokens).toHaveLength(0);
    expect(await memberForToken(token, "calendar")).toBeNull();
  });
});
