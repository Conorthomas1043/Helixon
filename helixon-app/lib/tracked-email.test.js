import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/mailer", () => ({ sendAgencyEmail: vi.fn(), senderEmail: vi.fn() }));
vi.mock("@/lib/candidates/activity", () => ({ logActivity: vi.fn() }));

const { inboundDomain, replyAddress, tokenFromAddress } = await import("./tracked-email");

afterEach(() => {
  delete process.env.RESEND_INBOUND_DOMAIN;
});

describe("reply addresses", () => {
  const token = "0123456789abcdef0123456789abcdef";

  it("are off without an inbound domain", () => {
    expect(inboundDomain()).toBeNull();
    expect(replyAddress(token)).toBeNull();
    expect(tokenFromAddress(`reply+${token}@reply.example.com`)).toBeNull();
  });

  it("round-trip with one", () => {
    process.env.RESEND_INBOUND_DOMAIN = "Reply.Example.com";
    expect(replyAddress(token)).toBe(`reply+${token}@reply.example.com`);
    expect(tokenFromAddress(`"Ana" <REPLY+${token}@reply.example.com>`)).toBe(token);
  });

  it("ignore other domains and malformed tokens", () => {
    process.env.RESEND_INBOUND_DOMAIN = "reply.example.com";
    expect(tokenFromAddress(`reply+${token}@evil.example.com`)).toBeNull();
    expect(tokenFromAddress("reply+nothex@reply.example.com")).toBeNull();
  });

  it("rejects a malformed domain setting", () => {
    process.env.RESEND_INBOUND_DOMAIN = "not a domain";
    expect(inboundDomain()).toBeNull();
  });
});
