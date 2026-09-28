import { describe, it, expect, vi } from "vitest";

const extracted = {
  name: "Jane Doe",
  current_employer: "Acme Corp",
  positions: [{ title: "Engineer", employer: "Acme Corp", start_year: 2018, end_year: 0 }],
  skills: ["Python"],
};

vi.mock("../extraction/index.js", () => ({
  extractCvText: async () => "Jane Doe\nEngineer at Acme Corp, Python",
  candidateExtractor: async () => structuredClone(extracted),
  jobExtractor: async () => ({ required_skills: ["Python"] }),
}));

const scoreCandidate = vi.fn(async (candidate, job, text) => ({ seen: { candidate, text } }));
vi.mock("../scoring/scoreCandidate.js", () => ({ default: (...a) => scoreCandidate(...a) }));

const { default: analyseCV } = await import("../pipeline/analyseCV.js");

describe("analyseCV blind mode", () => {
  it("hides name and employers from scoring but keeps them on the stored result", async () => {
    const { result } = await analyseCV({}, "Python developer role, long enough text here", { blind: true });
    const { candidate, text } = result.seen;
    expect(candidate.name).toBe("Candidate");
    expect(candidate.positions[0].employer).toBe("");
    expect(text).not.toContain("Jane Doe");
    expect(text).not.toContain("Acme Corp");
    expect(result.candidate.name).toBe("Jane Doe");
  });

  it("reuses a known parsed job instead of extracting it", async () => {
    const { jobParsed } = await analyseCV({}, "Some job", { jobParsed: { required_skills: ["Go"] } });
    expect(jobParsed.required_skills).toEqual(["Go"]);
  });
});
