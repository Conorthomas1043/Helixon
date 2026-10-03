import { describe, expect, it } from "vitest";
import { analyticsCsvRows } from "./analytics-csv";

const snapshot = {
  filters: { previous: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z" } },
  totals: { completed: 10, processing: 1, failed: 0 },
  placedInPeriod: 2,
  quality: { avgScore: 70, strong: 3, moderate: 4, weak: 3 },
  conversion: { shortlistRate: 50, interviewRate: 30, offerRate: 20, placementRate: 10 },
  deltas: { completed: -2, avgScore: 1, shortlistRate: 5, interviewRate: 0, offerRate: null, placementRate: 1 },
  funnel: [{ key: "Screened", label: "Screened", count: 10 }],
  pipeline: { stageCounts: { Screened: 4 }, stalled: 1 },
  trends: { unit: "month", points: [{ start: "2026-09-01", analysed: 10, placed: 2, fees: 9000 }] },
  calibration: { sampleSize: 4, bands: [{ label: "80+", total: 2, placed: 1, placementRate: 50 }] },
  team: [{ name: "Ana", activeCandidates: 3, placed: 1 }],
  timing: {
    timeToFillDays: 20,
    timeToHireDays: 15,
    offerAcceptance: { accepted: 1, declined: 0, pending: 1, rate: 100 },
    timeInStage: [{ label: "Screened", medianDays: 2 }],
    outreach: { total: 3, byType: [{ label: "Calls", count: 3 }], byRecruiter: [] },
    financial: { totalFee: 9000, totalCost: 1000, margin: 8000, avgFee: 4500, placementsWithFee: 2, byRecruiter: [] },
    retention: { thirtyDay: { retained: 1, left: 0, rate: 100 }, ninetyDay: { retained: 0, left: 0, rate: null } },
    reuse: { reused: 1, rate: 10 },
    feedback: { candidateNps: { score: 40, responses: 5, promoters: 3, passives: 1, detractors: 1 }, clientSatisfaction: { avgRating: 4.5, responses: 2 } },
  },
};

describe("analyticsCsvRows", () => {
  it("covers every section on the page", () => {
    const rows = analyticsCsvRows(snapshot, "Last 30 days");
    const sections = new Set(rows.map((r) => r.Section));
    for (const s of ["Filters", "Totals", "Quality", "Conversion", "Change vs previous period", "Funnel", "Pipeline", "Over time", "Score vs outcome", "Speed", "Time in stage", "Team", "Outreach", "Financials", "Retention", "Feedback"]) {
      expect(sections.has(s), s).toBe(true);
    }
    expect(rows).toContainEqual({ Section: "Change vs previous period", Metric: "Candidates analysed", Value: -2 });
    expect(rows).toContainEqual({ Section: "Change vs previous period", Metric: "Offer rate (points)", Value: "" });
    expect(rows).toContainEqual({ Section: "Over time", Metric: "Month of 2026-09-01 - fees", Value: 9000 });
  });

  it("copes with no timing data", () => {
    expect(() => analyticsCsvRows({ ...snapshot, timing: null, deltas: null, trends: null, calibration: null }, "All time")).not.toThrow();
  });
});
