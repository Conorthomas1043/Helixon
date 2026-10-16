import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ event: null, upserts: [], upsertError: null, updateError: null, subscription: null }));

vi.mock("@/lib/billing/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: () => state.event },
    subscriptions: { retrieve: async () => state.subscription },
  },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      upsert: async (row) => {
        state.upserts.push(row);
        return { error: state.upsertError };
      },
      update: () => ({ eq: () => ({ select: async () => ({ data: [], error: state.updateError }) }) }),
    }),
  },
}));
vi.mock("@/lib/analytics/server", () => ({ agencyIdForProfile: vi.fn(), billingEventsFor: () => [], captureAgencyEvent: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), after: vi.fn((fn) => fn()) }));
const converted = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agency/test-account", () => ({ markTestAccountConverted: converted }));

const { POST } = await import("./route");

const request = () => new Request("https://x.test/api/webhooks/stripe", { method: "POST", body: "{}", headers: { "stripe-signature": "sig" } });

beforeEach(() => {
  state.upserts = [];
  state.upsertError = null;
  state.updateError = null;
  state.subscription = { id: "sub_1", status: "active", items: { data: [] } };
});

describe("Stripe webhook", () => {
  it("stores the subscription's real status on checkout", async () => {
    state.subscription = { id: "sub_1", status: "incomplete", items: { data: [] } };
    state.event = { type: "checkout.session.completed", data: { object: { client_reference_id: "p1", subscription: "sub_1", customer: "cus_1", metadata: { plan: "agency" } } } };
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(state.upserts[0]).toMatchObject({ user_id: "p1", status: "incomplete", stripe_subscription_id: "sub_1" });
  });

  it("marks a test account as converted when its owner buys a plan", async () => {
    converted.mockReset();
    state.event = { type: "checkout.session.completed", data: { object: { client_reference_id: "p1", subscription: "sub_1", customer: "cus_1", metadata: {} } } };
    expect((await POST(request())).status).toBe(200);
    expect(converted).toHaveBeenCalledWith("p1");
  });

  it("answers 500 when the test account can't be marked converted, so Stripe retries", async () => {
    converted.mockReset().mockRejectedValue(new Error("db down"));
    state.event = { type: "checkout.session.completed", data: { object: { client_reference_id: "p1", subscription: "sub_1", customer: "cus_1", metadata: {} } } };
    expect((await POST(request())).status).toBe(500);
    converted.mockReset();
  });

  it("answers 500 when the subscription can't be saved, so Stripe retries", async () => {
    state.upsertError = { message: "connection reset" };
    state.event = { type: "checkout.session.completed", data: { object: { client_reference_id: "p1", subscription: "sub_1", customer: "cus_1", metadata: {} } } };
    expect((await POST(request())).status).toBe(500);
  });

  it("answers 500 when a status change can't be saved", async () => {
    state.updateError = { message: "timeout" };
    state.event = { type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled", items: { data: [] } } } };
    expect((await POST(request())).status).toBe(500);
  });
});
