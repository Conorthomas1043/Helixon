import { describe, expect, it } from "vitest";
import { cleanJobDetails, daysToTarget, jobOwnerId, priorityRank } from "./job-details";

describe("cleanJobDetails", () => {
  it("maps the fields to columns and leaves out what isn't there", () => {
    expect(cleanJobDetails({ ownerId: "user_1", openings: "3", feePercent: "18", feeAmount: "£9,000", priority: "high", targetDate: "2026-12-01" })).toEqual({
      owner_id: "user_1",
      openings: 3,
      fee_percent: 18,
      fee_amount: 9000,
      priority: "high",
      target_date: "2026-12-01",
    });
    expect(cleanJobDetails({ title: "x" })).toEqual({});
  });

  it("clears with null or empty", () => {
    expect(cleanJobDetails({ ownerId: null, openings: "", feePercent: null, priority: "", targetDate: "" })).toEqual({
      owner_id: null,
      openings: null,
      fee_percent: null,
      priority: null,
      target_date: null,
    });
  });

  it("refuses bad input", () => {
    expect(cleanJobDetails({ openings: 0 }).error).toBeTruthy();
    expect(cleanJobDetails({ openings: 2.5 }).error).toBeTruthy();
    expect(cleanJobDetails({ feePercent: 120 }).error).toBeTruthy();
    expect(cleanJobDetails({ priority: "asap" }).error).toBeTruthy();
    expect(cleanJobDetails({ targetDate: "soon" }).error).toBeTruthy();
    expect(cleanJobDetails({ ownerId: "has spaces" }).error).toBeTruthy();
  });
});

describe("helpers", () => {
  it("falls back to the creator as owner", () => {
    expect(jobOwnerId({ owner_id: null, user_id: "u1" })).toBe("u1");
    expect(jobOwnerId({ owner_id: "u2", user_id: "u1" })).toBe("u2");
  });
  it("ranks priorities", () => {
    expect([priorityRank("low"), priorityRank(null), priorityRank("urgent")]).toEqual([3, 2, 0]);
  });
  it("counts days to the target date", () => {
    const now = Date.parse("2026-10-03T15:00:00Z");
    expect(daysToTarget("2026-10-10", now)).toBe(7);
    expect(daysToTarget("2026-10-01", now)).toBe(-2);
    expect(daysToTarget(null, now)).toBeNull();
  });
});
