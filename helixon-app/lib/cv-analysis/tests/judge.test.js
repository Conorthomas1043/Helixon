import { describe, it, expect, vi, beforeEach } from "vitest";

const askClaude = vi.fn();
vi.mock("../anthropic/askClaude.js", () => ({ default: (...a) => askClaude(...a) }));

const { judgeFit } = await import("../scoring/fitJudgeEngine.js");

const cv = "Care Assistant, Oakview Care Home 2019-2024\n- Supported residents with personal care and mobility\n- Administered medication under supervision";

const base = {
  industry_relevance: { score: 80, rationale: "" },
  career_trajectory: { score: 60, label: "Static", rationale: "" },
  achievement_quality: { score: 40, rationale: "" },
  relevant_experience: { years: 5, rationale: "" },
};

describe("judgeFit requirement check", () => {
  beforeEach(() => askClaude.mockReset());

  it("keeps a requirement only when its quote is really in the CV", async () => {
    askClaude.mockResolvedValue({
      ...base,
      requirements_check: [
        { skill: "Personal care", demonstrated: true, evidence: "Supported residents with personal care and mobility" },
        { skill: "Dementia care", demonstrated: true, evidence: "Specialist in dementia care for 5 years" }, // not in the CV
        { skill: "Moving and handling", demonstrated: false, evidence: "" },
      ],
    });
    const j = await judgeFit({}, { title: "Care Assistant" }, cv, {
      unmatchedSkills: ["Personal care", "Dementia care", "Moving and handling"],
    });
    expect(j.requirements_check.map((r) => r.skill)).toEqual(["Personal care"]);
  });

  it("ignores skills it wasn't asked about and too-short quotes", async () => {
    askClaude.mockResolvedValue({
      ...base,
      requirements_check: [
        { skill: "Leadership", demonstrated: true, evidence: "Supported residents with personal care" },
        { skill: "Medication", demonstrated: true, evidence: "medication" },
      ],
    });
    const j = await judgeFit({}, {}, cv, { unmatchedSkills: ["Medication"] });
    expect(j.requirements_check).toEqual([]);
  });

  it("tells the model which requirements to check", async () => {
    askClaude.mockResolvedValue(base);
    await judgeFit({}, {}, cv, { unmatchedSkills: ["Personal care"] });
    expect(askClaude.mock.calls[0][0]).toContain("UNMATCHED REQUIREMENTS");
  });
});
