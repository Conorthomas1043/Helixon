import { describe, it, expect, vi, beforeEach } from "vitest";

// No network in tests: the fit judgement and embeddings are stubbed.
const judgment = {
  industry_relevance: { score: 80, rationale: "" },
  career_trajectory: { score: 70, label: "Positive", rationale: "" },
  achievement_quality: { score: 60, rationale: "" },
  relevant_experience: { years: 6, rationale: "" },
  method: "llm_judged",
  samples: 1,
};

vi.mock("../scoring/fitJudgeEngine.js", () => ({ judgeFit: vi.fn(async () => judgment) }));
vi.mock("../scoring/embeddingMatcher.js", () => ({
  embedSkills: vi.fn(async () => new Map()),
  findSemanticMatch: () => null,
}));

const { default: scoreCandidate } = await import("../scoring/scoreCandidate.js");
const { judgeFit } = await import("../scoring/fitJudgeEngine.js");

const job = {
  required_skills: ["Python", "SQL"],
  preferred_skills: [],
  min_years_experience: 5,
  skill_importance: { Python: "Critical", SQL: "Low" },
};

const cv = "Built data pipelines in Python for 6 years\nSkills: Python, SQL";

function candidate(skillDetails, extra = {}) {
  return { skills: ["Python", "SQL"], years_experience: 6, skill_details: skillDetails, ...extra };
}

beforeEach(() => judgeFit.mockImplementation(async () => judgment));

describe("scoreCandidate", () => {
  it("gives a listed-only skill less credit than a demonstrated one", async () => {
    const deep = await scoreCandidate(
      candidate([{ skill: "Python", depth: "Expert" }, { skill: "SQL", depth: "Expert" }]), job, cv);
    const shallow = await scoreCandidate(
      candidate([{ skill: "Python", depth: "Mentioned" }, { skill: "SQL", depth: "Mentioned" }]), job, cv);
    expect(deep.breakdown.RequiredSkills).toBeGreaterThan(shallow.breakdown.RequiredSkills);
  });

  it("weights a missing Critical skill more heavily than a missing Low one", async () => {
    const onlySql = await scoreCandidate(
      { skills: ["SQL"], years_experience: 6, skill_details: [{ skill: "SQL", depth: "Expert" }] }, job, cv);
    const onlyPython = await scoreCandidate(
      { skills: ["Python"], years_experience: 6, skill_details: [{ skill: "Python", depth: "Expert" }] }, job, cv);
    expect(onlyPython.breakdown.RequiredSkills).toBeGreaterThan(onlySql.breakdown.RequiredSkills);
  });

  it("scores experience on relevant years, not total career length", async () => {
    judgeFit.mockImplementation(async () => ({ ...judgment, relevant_experience: { years: 1, rationale: "" } }));
    const result = await scoreCandidate(
      candidate([{ skill: "Python", depth: "Expert" }], { years_experience: 12 }), job, cv);
    expect(result.relevant_years_experience).toBe(1);
    expect(result.breakdown.Experience).toBe(4); // 1/5 of 20
  });

  it("includes achievements in the total, neutral when the judgement fell back", async () => {
    const judged = await scoreCandidate(candidate([]), job, cv);
    expect(judged.breakdown.Achievements).toBe(6); // 60% of 10

    judgeFit.mockImplementation(async () => ({ ...judgment, method: "heuristic_fallback", relevant_experience: null,
      achievement_quality: { score: 0, rationale: "" } }));
    const fallback = await scoreCandidate(candidate([]), job, cv);
    expect(fallback.breakdown.Achievements).toBe(5);
  });

  it("keeps the total within 0-100 for a perfect candidate", async () => {
    judgeFit.mockImplementation(async () => ({
      ...judgment,
      industry_relevance: { score: 100, rationale: "" },
      career_trajectory: { score: 100, label: "Positive", rationale: "" },
      achievement_quality: { score: 100, rationale: "" },
    }));
    const result = await scoreCandidate(
      candidate([{ skill: "Python", depth: "Expert" }, { skill: "SQL", depth: "Expert" }]), job, cv);
    expect(result.breakdown.Total).toBe(100);
    expect(result.match_score).toBe(100);
  });
});
