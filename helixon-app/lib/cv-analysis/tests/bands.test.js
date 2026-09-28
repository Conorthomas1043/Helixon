import { describe, it, expect } from "vitest";
import { getScoreBand, STRONG_MATCH_MIN, REVIEW_MIN } from "../../scoreBands.js";
import { scoreLabel, scoreBandOf } from "../../candidate-format.js";
import { estimateSalary } from "../scoring/salaryEngine.js";

describe("score cut-offs", () => {
  it("labels the same score the same way everywhere", () => {
    for (const [score, band, label] of [
      [STRONG_MATCH_MIN, "Strong Match", "Strong match"],
      [REVIEW_MIN, "Worth Reviewing", "Moderate match"],
      [REVIEW_MIN - 1, "Weak Match", "Weak match"],
    ]) {
      expect(getScoreBand(score).band).toBe(band);
      expect(scoreLabel(score)).toBe(label);
    }
    expect(scoreBandOf(70)).toBe("60-79");
  });
});

describe("estimateSalary", () => {
  it("uses relevant years and says what it's based on", () => {
    const s = estimateSalary({ years_experience: 12 }, { relevantYears: 3, jobSalaryRange: "£60k-£75k" });
    expect(s.seniority).toBe("Mid");
    expect(s.confidence).toBeLessThan(50);
    expect(s.rationale).toContain("3 relevant years");
    expect(s.rationale).toContain("£60k-£75k");
  });

  it("falls back to total years", () => {
    expect(estimateSalary({ years_experience: 6 }).seniority).toBe("Senior");
  });
});
