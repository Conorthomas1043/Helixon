import { describe, expect, it } from "vitest";
import { buildVariants, compareToBaseline, nameSpread, withExtraLine, withName } from "./counterfactual.mjs";

const CV = "Priya Sharma\nLeeds | priya.sharma@example.com\n\nData Engineer (2021 - present)\n- Priya led the move to dbt\n";

describe("withName", () => {
  it("changes only the name, the email's local part and later mentions", () => {
    const out = withName(CV, "James Wilson");
    expect(out.split("\n")[0]).toBe("James Wilson");
    expect(out).toContain("james.wilson@example.com");
    expect(out).toContain("- James led the move to dbt");
    expect(out).not.toMatch(/Priya|Sharma/);
    // Everything else is untouched.
    expect(out.replace(/James Wilson|james\.wilson|James/g, "")).toBe(CV.replace(/Priya Sharma|priya\.sharma|Priya/g, ""));
  });
});

describe("buildVariants", () => {
  it("keeps a baseline and changes one thing per variant", () => {
    const variants = buildVariants(CV);
    expect(variants[0]).toEqual({ attribute: "baseline", cvText: CV });
    const gap = variants.find((v) => v.attribute === "career break: caring");
    expect(gap.cvText.startsWith(CV.trimEnd())).toBe(true);
    expect(withExtraLine(CV, "x").endsWith("\n\nx\n")).toBe(true);
    expect(new Set(variants.map((v) => v.attribute)).size).toBe(variants.length);
  });
});

describe("compareToBaseline", () => {
  const baseline = { attribute: "baseline", scores: [80, 82, 81], recommendations: ["Strong match", "Strong match", "Strong match"] };
  it("ignores differences inside run-to-run noise", () => {
    const [r] = compareToBaseline([baseline, { attribute: "name: x", scores: [81, 80, 82], recommendations: ["Strong match", "Strong match", "Strong match"] }]);
    expect(r.flagged).toBe(false);
  });
  it("flags a difference beyond noise, and any recommendation flip", () => {
    const [lower] = compareToBaseline([baseline, { attribute: "career break: caring", scores: [72, 73, 71], recommendations: ["Worth reviewing", "Worth reviewing", "Strong match"] }]);
    expect(lower.delta).toBe(-9);
    expect(lower.flipped).toBe(true);
    expect(lower.flagged).toBe(true);
  });
  it("reports the widest gap between name variants", () => {
    const spread = nameSpread([
      { attribute: "name: a", scores: [80], recommendations: [] },
      { attribute: "name: b", scores: [74], recommendations: [] },
      { attribute: "career break: caring", scores: [60], recommendations: [] },
    ]);
    expect(spread.gap).toBe(6);
    expect(spread.lowest.attribute).toBe("name: b");
  });
});
