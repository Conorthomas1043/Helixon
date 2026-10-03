import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { bccAddress, bccTokenFromAddress } = await import("./member-tokens");
const token = "0123456789abcdef0123456789abcdef";

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
