import { describe, expect, it } from "vitest";
import { agencyPerSeatNote, placementFeeExample, PLAN_PRICES, AGENCY_SEATS } from "./plan-features";

describe("pricing copy arithmetic", () => {
  it("states a per-seat figure that is really above the true per-seat price", () => {
    const shown = Number(agencyPerSeatNote().match(/£(\d+)/)[1]);
    expect(shown).toBeGreaterThanOrEqual(PLAN_PRICES.agency / AGENCY_SEATS);
    expect(agencyPerSeatNote()).toBe("Under £70 per recruiter with a team of 5.");
  });
  it("works the placement example out from the real Individual price", () => {
    expect(placementFeeExample()).toContain("earns £4,500");
    expect(placementFeeExample()).toContain("for 18 months");
    expect(18 * PLAN_PRICES.individual).toBeLessThanOrEqual(4500);
  });
});
