import { describe, it, expect } from "vitest";
import { benchmark } from "../scoring/benchmarkEngine.js";

// Thresholds are minimums to enter a band (score >= average/good/excellent),
// not a nearest-band rounding - a score below the "average" threshold (55)
// stays "Poor" even if it's closer to 55 than to 0. The original version of
// this test asserted benchmark(50).category === "Average", which doesn't
// match that behaviour (50 < 55) and would have failed under a real
// assertion library - it just never ran anywhere that would have caught it.
describe("benchmark", () => {
  it("categorises a score below the average threshold as Poor", () => {
    expect(benchmark(50).category).toBe("Poor");
    expect(benchmark(50).recommendation).toBe("Reject");
  });

  it("categorises a high score as Excellent", () => {
    expect(benchmark(90).category).toBe("Excellent");
    expect(benchmark(90).recommendation).toBe("Interview Immediately");
  });

  it("categorises scores right at each threshold correctly", () => {
    expect(benchmark(55).category).toBe("Average");
    expect(benchmark(70).category).toBe("Strong");
    expect(benchmark(85).category).toBe("Excellent");
  });
});
