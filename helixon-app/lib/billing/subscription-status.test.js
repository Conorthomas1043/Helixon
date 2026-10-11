import { describe, expect, it } from "vitest";
import { demoExpired, grantsAccess } from "./subscription-status";

const now = Date.parse("2026-09-29T12:00:00Z");

describe("grantsAccess", () => {
  it("follows the status for paid subscriptions", () => {
    expect(grantsAccess({ status: "active", stripe_subscription_id: "sub_1" }, now)).toBe(true);
    // A failed renewal Stripe is still retrying keeps access (grace period)...
    expect(grantsAccess({ status: "past_due", stripe_subscription_id: "sub_1" }, now)).toBe(true);
    // ...until Stripe stops retrying.
    expect(grantsAccess({ status: "unpaid", stripe_subscription_id: "sub_1" }, now)).toBe(false);
    expect(grantsAccess({ status: "canceled", stripe_subscription_id: "sub_1" }, now)).toBe(false);
    // An end date on a paid subscription is ignored.
    expect(grantsAccess({ status: "active", stripe_subscription_id: "sub_1", demo_expires_at: "2026-01-01T00:00:00Z" }, now)).toBe(true);
  });

  it("ends demo access at its end date", () => {
    const demo = { status: "active", stripe_subscription_id: null };
    expect(grantsAccess(demo, now)).toBe(true);
    expect(grantsAccess({ ...demo, demo_expires_at: "2026-09-30T00:00:00Z" }, now)).toBe(true);
    expect(grantsAccess({ ...demo, demo_expires_at: "2026-09-29T11:00:00Z" }, now)).toBe(false);
    expect(demoExpired({ ...demo, demo_expires_at: "2026-09-29T11:00:00Z" }, now)).toBe(true);
    expect(grantsAccess(null, now)).toBe(false);
  });
});
