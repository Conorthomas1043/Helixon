import { describe, expect, it } from "vitest";
import { aiWritingMetrics, pct } from "./ai-writing-eval.mjs";

describe("aiWritingMetrics", () => {
  it("counts hits, misses and false alarms, and false alarms per group", () => {
    const m = aiWritingMetrics([
      { label: "ai", flagged: true },
      { label: "ai", flagged: false },
      { label: "human", flagged: true, group: "non_native" },
      { label: "human", flagged: false, group: "non_native" },
      { label: "human", flagged: false, group: "native" },
    ]);
    expect(m.counts).toEqual({ tp: 1, fn: 1, fp: 1, tn: 2 });
    expect(m.precision).toBe(0.5);
    expect(m.recall).toBe(0.5);
    expect(m.falseAlarmRate).toBeCloseTo(1 / 3);
    expect(m.byGroup.non_native).toEqual({ humans: 2, falseAlarms: 1, rate: 0.5 });
    expect(pct(m.byGroup.native.rate)).toBe("0%");
  });

  it("copes with nothing to measure", () => {
    expect(aiWritingMetrics([]).precision).toBeNull();
    expect(pct(null)).toBe("-");
  });
});
