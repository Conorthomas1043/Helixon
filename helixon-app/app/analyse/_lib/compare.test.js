import { describe, it, expect } from "vitest";
import { columnLabels, skillRows, skillStatus, mustHaveRows, winners, verdict, coverage } from "./compare.js";

const job = {
  requiredSkills: ["Forklift", "Order picking", "Stock control"],
  preferredSkills: ["Team leadership"],
  skillImportance: { Forklift: "Low", "Order picking": "Critical" },
};

const amy = {
  name: "Amy",
  matchScore: 84,
  matchedSkills: ["Order picking", "Stock control"],
  missingRequired: ["Forklift"],
  skillCredit: [
    { skill: "Order picking", basis: "Expert" },
    { skill: "Stock control", basis: "Judged" },
  ],
  semanticMatches: [{ skill: "Stock control", via: "Ran weekly stock counts for the site", method: "cv_evidence" }],
  requirementsMet: [{ requirement: "right_to_work: UK", status: "unverified" }],
  relevantYears: 4,
};

const ben = {
  name: "Ben",
  blind: true,
  matchScore: 71,
  matchedSkills: ["Forklift"],
  missingRequired: ["Order picking", "Stock control"],
  skillCredit: [{ skill: "Forklift", basis: "Mentioned" }],
  requirementsMet: [{ requirement: "right_to_work: UK", status: "unverified" }, { requirement: "driving_licence: Full UK", status: "not_met" }],
  relevantYears: 1,
};

describe("columnLabels", () => {
  it("keeps blind-screened candidates anonymous", () => {
    expect(columnLabels([amy, ben])).toEqual(["Amy", "Candidate B"]);
  });
});

describe("skillStatus / skillRows", () => {
  it("reports depth, CV evidence and missing skills", () => {
    expect(skillStatus(amy, "Order picking")).toMatchObject({ state: "strong", label: "Expert" });
    expect(skillStatus(amy, "Stock control")).toMatchObject({ state: "strong", label: "Shown in CV", evidence: "Ran weekly stock counts for the site" });
    expect(skillStatus(ben, "Forklift")).toMatchObject({ state: "weak", label: "Listed only" });
    expect(skillStatus(amy, "Forklift")).toMatchObject({ state: "missing" });
  });

  it("orders required skills by importance", () => {
    const rows = skillRows(job, [amy, ben]);
    expect(rows.map((r) => r.skill)).toEqual(["Order picking", "Stock control", "Forklift"]);
    expect(coverage(rows, 0)).toEqual({ met: 2, of: 3 });
  });

  it("falls back to the analyses' skills for an older role", () => {
    const rows = skillRows({}, [amy, ben]);
    expect(rows.map((r) => r.skill).sort()).toEqual(["Forklift", "Order picking", "Stock control"]);
  });
});

describe("mustHaveRows", () => {
  it("unions requirements across candidates", () => {
    const rows = mustHaveRows([amy, ben]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.requirement.startsWith("driving")).cells).toEqual([null, "not_met"]);
  });
});

describe("winners", () => {
  it("finds the best value, and none on a full tie", () => {
    expect(winners([84, 71])).toEqual([0]);
    expect(winners([2, 5], { lowerIsBetter: true })).toEqual([0]);
    expect(winners([70, 70])).toEqual([]);
    expect(winners([70, null])).toEqual([]);
  });
});

describe("verdict", () => {
  it("summarises the lead, skill edges, experience and must-haves", () => {
    const candidates = [amy, ben];
    const labels = columnLabels(candidates);
    const lines = verdict(candidates, labels, skillRows(job, candidates), mustHaveRows(candidates));
    expect(lines[0]).toContain("Amy leads overall with 84, 13 points ahead of Candidate B");
    expect(lines.some((l) => l.includes("Order picking and Stock control"))).toBe(true);
    expect(lines.some((l) => l.includes("Candidate B has Forklift"))).toBe(true);
    expect(lines.some((l) => l.includes("most relevant experience"))).toBe(true);
    expect(lines.some((l) => l.includes("doesn't meet"))).toBe(true);
    expect(lines.some((l) => l.includes("confirm at interview"))).toBe(true);
  });

  it("calls a near-tie a tie", () => {
    const lines = verdict([{ ...amy, matchScore: 80 }, { ...ben, matchScore: 78 }], ["A", "B"], [], []);
    expect(lines[0]).toContain("level on overall score");
  });
});
