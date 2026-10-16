import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paid = vi.fn();
const allow = vi.fn();
const send = vi.fn();
const testRefusal = vi.fn();

vi.mock("@/lib/supabase", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "Acme" } }) }) }) }) } }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: async () => null }));
vi.mock("@/lib/auth/customer-auth", () => ({ agencyHasActiveSubscription: (...args) => paid(...args) }));
vi.mock("@/lib/agency/test-account", () => ({ testEmailRefusal: (...args) => testRefusal(...args) }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args) => allow(...args) }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args) => send(...args) };
  },
}));

const { AGENCY_EMAILS_PER_HOUR, SUBSCRIPTION_NEEDED_TO_SEND, _clearMailerCache, agencySendRefusal, sendAgencyEmail } = await import("./mailer");

beforeEach(() => {
  _clearMailerCache();
  paid.mockReset().mockResolvedValue(true);
  allow.mockReset().mockResolvedValue(true);
  testRefusal.mockReset().mockResolvedValue(null);
  send.mockReset().mockResolvedValue({ data: { id: "em_1" }, error: null });
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "mail@helixon.test";
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("agencySendRefusal", () => {
  it("lets a paid agency send, charged against its hourly cap", async () => {
    expect(await agencySendRefusal("ag_1", { count: 3 })).toBeNull();
    expect(allow).toHaveBeenCalledWith("agency-email:ag_1", AGENCY_EMAILS_PER_HOUR, { cost: 3 });
  });

  it("refuses an agency without a subscription", async () => {
    paid.mockResolvedValue(false);
    expect(await agencySendRefusal("ag_1")).toBe(SUBSCRIPTION_NEEDED_TO_SEND);
    expect(allow).not.toHaveBeenCalled();
  });

  it("lets alerts to the agency's own members through without one, still capped", async () => {
    paid.mockResolvedValue(false);
    expect(await agencySendRefusal("ag_1", { toMember: true })).toBeNull();
    allow.mockResolvedValue(false);
    expect(await agencySendRefusal("ag_1", { toMember: true })).toMatch(/a lot of email/);
  });

  it("refuses when the subscription check fails, and with no agency", async () => {
    paid.mockRejectedValue(new Error("db down"));
    expect(await agencySendRefusal("ag_1")).toBe(SUBSCRIPTION_NEEDED_TO_SEND);
    expect(await agencySendRefusal(null)).toBeTruthy();
  });
});

describe("agencySendRefusal for a test workspace", () => {
  it("applies the daily allowance to the whole batch of outside email", async () => {
    testRefusal.mockResolvedValue("This account can send up to 20 emails a day");
    expect(await agencySendRefusal("ag_1", { count: 4 })).toMatch(/20 emails a day/);
    expect(testRefusal).toHaveBeenCalledWith("ag_1", 4);
    expect(allow).not.toHaveBeenCalled();
  });

  it("doesn't count alerts to the workspace's own members", async () => {
    testRefusal.mockResolvedValue("refused");
    expect(await agencySendRefusal("ag_1", { toMember: true })).toBeNull();
    expect(testRefusal).not.toHaveBeenCalled();
  });
});

describe("sendAgencyEmail", () => {
  it("doesn't call Resend for an unpaid agency", async () => {
    paid.mockResolvedValue(false);
    expect(await sendAgencyEmail({ agencyId: "ag_1", to: "x@example.com", subject: "Hi", text: "Hi", replyTo: null })).toEqual({ error: SUBSCRIPTION_NEEDED_TO_SEND });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends for a paid agency", async () => {
    expect(await sendAgencyEmail({ agencyId: "ag_1", to: "x@example.com", subject: "Hi", text: "Hi", replyTo: null })).toEqual({ id: "em_1" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
