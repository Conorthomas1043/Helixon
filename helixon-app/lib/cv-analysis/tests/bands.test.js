import { describe, it, expect } from "vitest";
import { getScoreBand, STRONG_MATCH_MIN, REVIEW_MIN } from "../../scoreBands.js";
import { scoreLabel, scoreBandOf } from "../../candidate-format.js";
import { estimateSalary } from "../scoring/salaryEngine.js";

describe("score cut-offs", () => {
  it("labels the same score the same way everywhere", () => {
    for (const [score, band, label] of [
      [STRONG_MATCH_MIN, "Strong match", "Strong match"],
      [REVIEW_MIN, "Worth reviewing", "Worth reviewing"],
      [REVIEW_MIN - 1, "Weak match", "Weak match"],
    ]) {
      expect(getScoreBand(score).band).toBe(band);
      expect(scoreLabel(score)).toBe(label);
    }
    expect(scoreBandOf(70)).toBe("60-79");
  });
});

describe("estimateSalary", () => {
  it("places the candidate within the role's own range", () => {
    const job = { market_salary: { low: 24000, high: 30000, currency: "GBP" }, min_years_experience: 2, salary_range: "£24k-£30k" };
    const junior = estimateSalary({ years_experience: 1 }, { relevantYears: 1, job });
    const experienced = estimateSalary({ years_experience: 8 }, { relevantYears: 8, job });
    expect(junior.low).toBe(24000);
    expect(experienced.high).toBe(30000);
    expect(junior.high).toBeLessThan(experienced.low + 1);
    expect(experienced.rationale).toContain("£24k-£30k");
  });

  it("keeps hourly pay hourly", () => {
    const s = estimateSalary({}, { relevantYears: 1, job: { role_type: "frontline", market_salary: { low: 12.21, high: 14, currency: "GBP", period: "hour" } } });
    expect(s.period).toBe("hour");
    expect(s.low).toBeCloseTo(12.2, 1);
    expect(s.high).toBeLessThan(15);
  });

  it("keeps the currency of the role", () => {
    const s = estimateSalary({}, { relevantYears: 3, job: { market_salary: { low: 90000, high: 120000, currency: "USD" } } });
    expect(s.currency).toBe("USD");
  });

  it("falls back to tech bands only for tech or unknown roles", () => {
    expect(estimateSalary({ years_experience: 6 }).seniority).toBe("Senior");
    expect(estimateSalary({ years_experience: 10 }, { job: { job_family: "healthcare" } })).toBeNull();
  });
});
