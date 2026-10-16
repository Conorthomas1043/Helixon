import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ event: null, tables: [], claim: vi.fn(), create: vi.fn() }));

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return state.event;
    }
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "svix-id": "1", "svix-timestamp": "1", "svix-signature": "s" }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table) => {
      state.tables.push(table);
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }) };
      return chain;
    },
  },
}));
vi.mock("@/lib/auth/create-profile", () => ({
  checkoutClaim: (...args) => state.claim(...args),
  createProfileAndAgency: (...args) => state.create(...args),
  linkSubscriptionFromStripeSession: vi.fn(),
  generateUsername: vi.fn(),
}));
vi.mock("@/lib/compliance/anonymise-user", () => ({ anonymiseDeletedUser: vi.fn() }));
vi.mock("@/lib/auth/clerk-org", () => ({ AGENCY_SEAT_LIMIT: 10, getOrgSeatUsage: vi.fn(), revokeAgencyOrgInvitation: vi.fn() }));
vi.mock("@/lib/agency/member-tokens", () => ({ revokeMemberTokens: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const { POST } = await import("./route");

const request = () => new Request("https://x.test/api/webhooks/clerk", { method: "POST", body: "{}" });

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  state.tables = [];
  state.claim.mockReset().mockResolvedValue({ ok: false, reason: "no_session" });
  state.create.mockReset();
});

describe("Clerk webhook user.created", () => {
  it("skips users flagged helixon_test_account (the console makes their workspace)", async () => {
    state.event = { type: "user.created", data: { id: "user_t", username: "anatest", public_metadata: { helixon_test_account: true }, email_addresses: [] } };
    expect((await POST(request())).status).toBe(200);
    expect(state.tables).toEqual([]);
    expect(state.claim).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });

  it("still checks an ordinary sign-up for a paid checkout", async () => {
    state.event = { type: "user.created", data: { id: "user_o", username: "ordinary", public_metadata: {}, email_addresses: [] } };
    expect((await POST(request())).status).toBe(200);
    expect(state.claim).toHaveBeenCalled();
  });
});
