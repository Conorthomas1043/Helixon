import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ subscriptions: [], session: null, subscription: null }));

function subscriptionsQuery() {
  const filters = [];
  let limitN;
  const run = () => state.subscriptions.filter((r) => filters.every((f) => f(r))).slice(0, limitN);
  const q = {
    select: () => q,
    eq: (col, v) => (filters.push((r) => r[col] === v), q),
    neq: (col, v) => (filters.push((r) => r[col] !== v), q),
    limit: (n) => ((limitN = n), q),
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    upsert: async (row) => {
      const i = state.subscriptions.findIndex((r) => r.user_id === row.user_id);
      if (i >= 0) state.subscriptions[i] = { ...state.subscriptions[i], ...row };
      else state.subscriptions.push(row);
      return { error: null };
    },
    then: (resolve) => resolve({ data: run(), error: null }),
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({ supabase: { from: () => subscriptionsQuery() } }));
vi.mock("@/lib/lifecycle-email", () => ({ sendWelcomeEmail: async () => {} }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/billing/stripe", () => ({
  stripe: {
    checkout: { sessions: { retrieve: async () => state.session } },
    subscriptions: { retrieve: async () => state.subscription },
  },
}));

const { linkSubscriptionFromStripeSession } = await import("@/lib/auth/create-profile");

const session = (over = {}) => ({
  id: "cs_1",
  payment_status: "paid",
  status: "complete",
  subscription: "sub_1",
  customer: "cus_1",
  metadata: { userId: "p1", plan: "agency" },
  ...over,
});

beforeEach(() => {
  state.subscriptions = [];
  state.session = session();
  state.subscription = { id: "sub_1", status: "active", items: { data: [] } };
});

describe("linkSubscriptionFromStripeSession", () => {
  it("stores the subscription's real status from Stripe", async () => {
    state.subscription = { id: "sub_1", status: "incomplete", items: { data: [] } };
    const result = await linkSubscriptionFromStripeSession({ profileId: "p1", stripeSessionId: "cs_1", clerkUserId: "user_1" });
    expect(result.linked).toBe(true);
    expect(state.subscriptions[0]).toMatchObject({ user_id: "p1", stripe_subscription_id: "sub_1", status: "incomplete", plan: "agency" });
  });

  it("never re-activates a cancelled subscription when an old session is replayed", async () => {
    state.subscriptions = [{ user_id: "p1", stripe_subscription_id: "sub_1", status: "canceled", plan: "agency" }];
    const result = await linkSubscriptionFromStripeSession({ profileId: "p1", stripeSessionId: "cs_1", clerkUserId: "user_1" });
    expect(result).toMatchObject({ linked: true, already: true });
    expect(state.subscriptions[0].status).toBe("canceled");
  });

  it("never lets an older, ended subscription replace the current one", async () => {
    state.subscriptions = [{ user_id: "p1", stripe_subscription_id: "sub_2", status: "active", plan: "agency" }];
    state.subscription = { id: "sub_1", status: "canceled", items: { data: [] } };
    const result = await linkSubscriptionFromStripeSession({ profileId: "p1", stripeSessionId: "cs_1", clerkUserId: "user_1" });
    expect(result).toEqual({ linked: false, reason: "subscription_not_live" });
    expect(state.subscriptions[0]).toMatchObject({ stripe_subscription_id: "sub_2", status: "active" });
  });

  it("refuses a subscription another profile already holds", async () => {
    state.subscriptions = [{ user_id: "p2", stripe_subscription_id: "sub_1", status: "active" }];
    const result = await linkSubscriptionFromStripeSession({ profileId: "p1", stripeSessionId: "cs_1", clerkUserId: "user_1" });
    expect(result).toEqual({ linked: false, reason: "session_already_claimed" });
    expect(state.subscriptions).toHaveLength(1);
  });

  it("refuses a session that belongs to someone else", async () => {
    const result = await linkSubscriptionFromStripeSession({ profileId: "p9", stripeSessionId: "cs_1", clerkUserId: "user_9" });
    expect(result.reason).toBe("session_belongs_to_another_user");
  });

  it("refuses a session with no subscription", async () => {
    state.session = session({ subscription: null });
    const result = await linkSubscriptionFromStripeSession({ profileId: "p1", stripeSessionId: "cs_1", clerkUserId: "user_1" });
    expect(result).toEqual({ linked: false, reason: "no_subscription" });
  });
});
