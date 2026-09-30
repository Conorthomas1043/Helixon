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
    // 1/5 of the experience weight. The job lists no preferred skills, so
    // their 15 points are shared out and experience is worth 20/85 x 100.
    expect(result.breakdown.Experience).toBe(5);
  });

  it("includes achievements in the total, neutral when the judgement fell back", async () => {
    const judged = await scoreCandidate(candidate([]), job, cv);
    expect(judged.breakdown.Achievements).toBe(7); // 60% of 11.8 (10 scaled up - no preferred skills)

    judgeFit.mockImplementation(async () => ({ ...judgment, method: "heuristic_fallback", relevant_experience: null,
      achievement_quality: { score: 0, rationale: "" } }));
    const fallback = await scoreCandidate(candidate([]), job, cv);
    expect(fallback.breakdown.Achievements).toBe(6); // neutral 50%
    expect(fallback.warnings.some((w) => /Re-screen/.test(w))).toBe(true);
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

describe("interview questions", () => {
  it("probes listed-only required skills and never asks about gaps", async () => {
    const result = await scoreCandidate(
      candidate([{ skill: "Python", depth: "Expert" }, { skill: "SQL", depth: "Mentioned" }]), job, cv);
    expect(result.interview_questions.some((q) => q.includes("SQL"))).toBe(true);
    expect(result.interview_questions.some((q) => /gap/i.test(q))).toBe(false);
  });
});

describe("requirements shown by described work (any profession)", () => {
  const careJob = { required_skills: ["Personal care", "Medication administration"], preferred_skills: [], min_years_experience: 1 };
  const careCv = "Care Assistant 2019-2024\nSupported residents with personal care and mobility";

  it("sends skills the keyword pass missed to the judgement", async () => {
    await scoreCandidate({ skills: ["Teamwork"], years_experience: 5 }, careJob, careCv);
    const [, , , opts] = judgeFit.mock.calls.at(-1);
    expect(opts.unmatchedSkills).toEqual(["Personal care", "Medication administration"]);
  });

  it("credits a requirement the judgement confirmed with a verified quote", async () => {
    judgeFit.mockImplementation(async () => ({
      ...judgment,
      requirements_check: [{ skill: "Personal care", evidence: "Supported residents with personal care and mobility" }],
    }));
    const result = await scoreCandidate({ skills: ["Teamwork"], years_experience: 5 }, careJob, careCv);
    expect(result.matched_skills).toContain("Personal care");
    expect(result.missing_required).toEqual(["Medication administration"]);
    const credit = result.skill_credit.find((c) => c.skill === "Personal care");
    expect(credit.basis).toBe("Judged");
    expect(result.semantic_matches).toContainEqual(expect.objectContaining({ skill: "Personal care", method: "cv_evidence" }));
    expect(result.evidence.find((e) => e.skill === "Personal care").supported).toBe(true);
  });
});

describe("frontline scoring", () => {
  const warehouseJob = { role_type: "frontline", required_skills: ["Order picking"], preferred_skills: [], min_years_experience: 0 };
  const warehouseCv = "Warehouse Operative 2023-2024\nPicked and packed orders";

  it("doesn't dock points for an unquantified CV or a flat career", async () => {
    judgeFit.mockImplementation(async () => ({
      ...judgment,
      achievement_quality: { score: 10, rationale: "" },
      career_trajectory: { score: 60, label: "Static", rationale: "" },
      relevant_experience: { years: 2, rationale: "" },
    }));
    const result = await scoreCandidate(
      { skills: ["Order picking"], years_experience: 2, skill_details: [{ skill: "Order picking", depth: "Used" }] },
      warehouseJob, warehouseCv);
    expect(result.breakdown.Achievements).toBe(0);
    expect(result.breakdown.Experience).toBe(29); // 2 years = full credit for frontline (25, scaled up - no preferred skills)
    expect(result.match_score).toBeGreaterThanOrEqual(80);
  });

  it("doesn't raise hiring risk because the CV is short or messy", async () => {
    judgeFit.mockImplementation(async () => judgment);
    const result = await scoreCandidate(
      { skills: ["Order picking"], years_experience: 2, skill_details: [{ skill: "Order picking", depth: "Used" }],
        cv_quality_issues: ["no dates", "inconsistent formatting", "very short", "no summary", "spelling"] },
      warehouseJob, warehouseCv);
    expect(result.risk.level).toBe("Low");
    expect(result.red_flags).not.toContain("Overall hiring risk assessed as High");
  });
});

describe("scoring rule fixes", () => {
  it("shares out the skill points when the job names no skills, and says so", async () => {
    const vague = { required_skills: [], preferred_skills: [], min_years_experience: 0 };
    const result = await scoreCandidate(candidate([]), vague, cv);
    expect(result.breakdown.RequiredSkills).toBe(0);
    expect(result.breakdown.PreferredSkills).toBe(0);
    expect(result.skill_score).toBeNull();
    // Everyone used to get the free 50 skill points; now the rest carry 100.
    expect(result.breakdown.Experience).toBe(40); // 6 years = full credit, 20/50 x 100
    expect(result.warnings.some((w) => /doesn't name specific skills/.test(w))).toBe(true);
  });

  it("works the total out before rounding, so the parts can't drift across a band line", async () => {
    const result = await scoreCandidate(candidate([{ skill: "Python", depth: "Expert" }, { skill: "SQL", depth: "Used" }]), job, cv);
    const parts = ["RequiredSkills", "PreferredSkills", "Experience", "Career", "Industry", "Achievements"]
      .reduce((sum, k) => sum + result.breakdown[k], 0);
    expect(Math.abs(result.breakdown.Total - parts)).toBeLessThanOrEqual(3);
    expect(result.match_score).toBe(result.breakdown.Total);
  });

  it("passes a minimum-years requirement on relevant years, not total career", async () => {
    judgeFit.mockImplementation(async () => ({ ...judgment, relevant_experience: { years: 1, rationale: "" } }));
    const withRule = { ...job, knockout_requirements: [{ field: "min_years_experience", value: "5", required: true }] };
    const result = await scoreCandidate(candidate([{ skill: "Python", depth: "Expert" }], { years_experience: 12 }), withRule, cv);
    expect(result.requirements_met[0].status).toBe("not_met");
    expect(result.match_score).toBeLessThanOrEqual(40);
  });

  it("warns when the CV was too long to read in full", async () => {
    const result = await scoreCandidate(candidate([]), job, `${cv}\n${"x".repeat(40000)}`);
    expect(result.warnings.some((w) => /unusually long/.test(w))).toBe(true);
  });
});
