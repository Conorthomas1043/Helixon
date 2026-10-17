import { describe, expect, it } from "vitest";
import { buildReport, skillEvidence } from "./analysis-report";

const scored = {
  match_score: 88,
  evidence: [
    { skill: "Order picking", supported: true, evidence: [{ skill: "Order picking", evidence: "  Picked 1,200 lines a shift on RF scanners  ", confidence: "High" }] },
    { skill: "Forklift", supported: false, evidence: [] },
    { skill: "Stock control", supported: true, evidence: [{ skill: "Stock control", evidence: "Ran weekly stock counts across three aisles", confidence: "High" }] },
    { skill: "Rota planning", supported: true, evidence: [{ skill: "Rota planning", evidence: "", confidence: "Low" }] },
  ],
};

describe("skillEvidence", () => {
  it("quotes the CV line behind each supported skill", () => {
    expect(skillEvidence(scored)).toEqual([
      { skill: "Order picking", quote: "Picked 1,200 lines a shift on RF scanners" },
      { skill: "Stock control", quote: "Ran weekly stock counts across three aisles" },
    ]);
  });

  it("quotes nothing for a blind screen, where a CV line could name an employer or school", () => {
    expect(skillEvidence(scored, { blind: true })).toEqual([]);
  });

  it("copes with results that have no evidence", () => {
    expect(skillEvidence({})).toEqual([]);
    expect(skillEvidence(null)).toEqual([]);
  });

  it("is on the report", () => {
    expect(buildReport(scored, {}).skill_evidence).toHaveLength(2);
    expect(buildReport(scored, {}, { blind: true }).skill_evidence).toEqual([]);
  });
});
