import { describe, expect, it } from "vitest";
import { cleanNextAction, cleanOpportunity, effectiveProbability, pipelineSummary } from "./opportunities";

describe("cleanOpportunity", () => {
  it("maps fields to columns", () => {
    expect(cleanOpportunity({ title: " Senior hires ", stage: "meeting", value: "£25,000", probability: "40", expectedClose: "2026-11-30", ownerId: "u1" }, { requireTitle: true })).toEqual({
      title: "Senior hires",
      stage: "meeting",
      value: 25000,
      probability: 40,
      expected_close: "2026-11-30",
      owner_id: "u1",
    });
  });
  it("needs a title on create and refuses bad values", () => {
    expect(cleanOpportunity({}, { requireTitle: true }).error).toBeTruthy();
    expect(cleanOpportunity({ stage: "maybe" }).error).toBeTruthy();
    expect(cleanOpportunity({ probability: 150 }).error).toBeTruthy();
    expect(cleanOpportunity({ value: -1 }).error).toBeTruthy();
    expect(cleanOpportunity({ expectedClose: "next week" }).error).toBeTruthy();
  });
});

describe("pipelineSummary", () => {
  const deals = [
    { stage: "lead", value: 10000, probability: null },
    { stage: "proposal", value: 20000, probability: 50 },
    { stage: "won", value: 15000, closedAt: "2026-10-02T10:00:00Z" },
    { stage: "won", value: 5000, closedAt: "2026-09-02T10:00:00Z" },
    { stage: "lost", value: 8000, closedAt: "2026-10-01T10:00:00Z" },
  ];
  it("totals open, weighted and won value", () => {
    const s = pipelineSummary(deals, new Date("2026-10-01T00:00:00Z"));
    expect(s.openCount).toBe(2);
    expect(s.openValue).toBe(30000);
    expect(s.weightedValue).toBe(1000 + 10000);
    expect(s.wonCount).toBe(1);
    expect(s.wonValue).toBe(15000);
    expect(s.winRate).toBe(50);
    expect(s.byStage.won.count).toBe(2);
  });
  it("uses the stage's typical probability when none is set", () => {
    expect(effectiveProbability({ stage: "meeting", probability: null })).toBe(40);
    expect(effectiveProbability({ stage: "meeting", probability: 0 })).toBe(0);
  });
});

describe("cleanNextAction", () => {
  it("needs a label and a real date", () => {
    expect(cleanNextAction({ label: "Call Sam", dueAt: "2026-10-05T09:00:00Z" }).nextAction).toEqual({ label: "Call Sam", dueAt: "2026-10-05T09:00:00.000Z", completed: false });
    expect(cleanNextAction({ label: "" }).error).toBeTruthy();
    expect(cleanNextAction({ label: "x", dueAt: "soon" }).error).toBeTruthy();
  });
});
