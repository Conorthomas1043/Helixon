import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const { billingEventsFor } = await import("./server-analytics");

describe("billingEventsFor", () => {
  it("reports a failed renewal and its recovery", () => {
    expect(billingEventsFor("customer.subscription.updated", { status: "past_due" }, { status: "active" })).toEqual([
      { event: "payment_failed", properties: { from: "active" } },
    ]);
    expect(billingEventsFor("customer.subscription.updated", { status: "active" }, { status: "past_due" })).toEqual([
      { event: "payment_recovered", properties: {} },
    ]);
  });

  it("reports cancellation, scheduled cancellation and plan changes", () => {
    expect(billingEventsFor("customer.subscription.deleted", { status: "canceled" })[0].event).toBe("subscription_cancelled");
    expect(billingEventsFor("customer.subscription.updated", { status: "active", cancel_at_period_end: true }, { cancel_at_period_end: false })[0].event).toBe(
      "subscription_cancel_scheduled"
    );
    expect(billingEventsFor("customer.subscription.updated", { status: "active" }, { items: {} })[0].event).toBe("plan_changed");
  });

  it("reports nothing for an update that changed neither", () => {
    expect(billingEventsFor("customer.subscription.updated", { status: "active" }, { metadata: {} })).toEqual([]);
  });
});
