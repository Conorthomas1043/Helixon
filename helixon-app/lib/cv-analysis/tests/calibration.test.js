import { describe, it, expect } from "vitest";
import { auc, calibrate, componentShares, fitLogistic, labelFor, toWeights, COMPONENTS } from "../calibration/index.js";

// Deterministic pseudo-random numbers, so the synthetic data is the same every run.
function random(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Recruiters who care mostly about experience, then required skills.
function syntheticRows(n, seed = 7) {
  const rnd = random(seed);
  const truth = { required: 3, preferred: 0, experience: 6, industry: 1, career: 0, achievements: 0 };
  return Array.from({ length: n }, () => {
    const shares = Object.fromEntries(COMPONENTS.map((k) => [k, rnd()]));
    const z = COMPONENTS.reduce((s, k) => s + shares[k] * truth[k], 0) - 5;
    return { shares, label: rnd() < 1 / (1 + Math.exp(-z)) ? 1 : 0 };
  });
}

describe("labelFor", () => {
  it("takes the recruiter's band first, then the pipeline", () => {
    expect(labelFor({ expectedBand: "Worth reviewing", stage: "Rejected", rejectionReason: "skills_gap" })).toBe(1);
    expect(labelFor({ expectedBand: "Not suitable" })).toBe(0);
    expect(labelFor({ stage: "Placed" })).toBe(1);
    expect(labelFor({ stage: "Rejected", rejectionReason: "skills_gap" })).toBe(0);
  });

  it("ignores outcomes that say nothing about the CV", () => {
    expect(labelFor({ stage: "Rejected", rejectionReason: "candidate_withdrew" })).toBeNull();
    expect(labelFor({ stage: "Screened" })).toBeNull();
  });
});

describe("componentShares", () => {
  it("turns points back into 0-1 shares using the weights the score was made with", () => {
    const shares = componentShares({
      score_weights: { required: 40, preferred: 0, experience: 20, industry: 10, career: 10, achievements: 20 },
      breakdown: { RequiredSkills: 30, PreferredSkills: 0, Experience: 20, Industry: 5, Career: 10, Achievements: 0 },
    });
    expect(shares.required).toBe(0.75);
    expect(shares.preferred).toBeNull(); // carried no weight
    expect(shares.industry).toBe(0.5);
  });
});

describe("auc and weights", () => {
  it("computes AUC", () => {
    expect(auc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0])).toBe(1);
    expect(auc([0.1, 0.9], [1, 0])).toBe(0);
    expect(auc([0.5], [1])).toBeNull();
  });

  it("turns coefficients into whole weights summing to 100, dropping negatives", () => {
    const weights = toWeights([3, -1, 1, 0, 0, 0]);
    expect(Object.values(weights).reduce((s, x) => s + x, 0)).toBe(100);
    expect(weights).toMatchObject({ required: 75, preferred: 0, experience: 25 });
  });
});

describe("calibrate", () => {
  it("recovers what recruiters actually weight from their decisions", () => {
    const rows = syntheticRows(600);
    const model = fitLogistic(rows.map((r) => COMPONENTS.map((k) => r.shares[k])), rows.map((r) => r.label));
    const w = toWeights(model.coefficients);
    expect(w.experience).toBeGreaterThan(w.required);
    expect(w.required).toBeGreaterThan(w.career);
  });

  it("recommends new weights only when they rank candidates clearly better", () => {
    const report = calibrate(syntheticRows(600), { roleType: "professional" });
    expect(report.labels).toBe(600);
    expect(report.fittedAuc).toBeGreaterThan(report.currentAuc);
    expect(report.ready).toBe(true);
    expect(Object.values(report.suggested).reduce((s, x) => s + x, 0)).toBe(100);
  });

  it("refuses to suggest anything from too few labels", () => {
    const report = calibrate(syntheticRows(30));
    expect(report.ready).toBe(false);
    expect(report.suggested).toBeNull();
    expect(report.reason).toMatch(/Needs at least 100/);
  });
});
