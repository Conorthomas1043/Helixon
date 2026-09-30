import { describe, it, expect } from "vitest";
import { containsPhrase, skillMatch } from "../utils/skillNormaliser.js";
import { semanticMatch } from "../scoring/semanticMatcher.js";
import { collectEvidence } from "../scoring/evidenceEngine.js";
import { applyKnockouts } from "../scoring/knockoutEngine.js";
import validateJob from "../validators/validateJob.js";

describe("containsPhrase / skillMatch", () => {
  it("matches whole words only", () => {
    expect(containsPhrase("Built services in JavaScript", "Java")).toBe(false);
    expect(containsPhrase("A good communicator", "Go")).toBe(false);
    expect(containsPhrase("Wrote backend services in Go", "Go")).toBe(true);
    expect(containsPhrase("Senior Java developer", "Java")).toBe(true);
  });

  it("keeps C, C++ and C# apart", () => {
    expect(containsPhrase("Embedded C++ firmware", "C")).toBe(false);
    expect(containsPhrase("C# and .NET services", "C")).toBe(false);
    expect(containsPhrase("Embedded C++ firmware", "C++")).toBe(true);
  });

  it("treats punctuation variants as the same skill", () => {
    expect(skillMatch("Node.js", "node js")).toBe(true);
  });
});

describe("semanticMatch whole-word fallback", () => {
  it("accepts a more specific form of the required skill", () => {
    expect(semanticMatch("AWS", ["AWS Lambda"]).matched).toBe(true);
  });

  it("does not let one shared word satisfy a multi-word requirement", () => {
    expect(semanticMatch("Project Management", ["Management"]).matched).toBe(false);
    expect(semanticMatch("Machine Learning", ["Learning"]).matched).toBe(false);
  });

  it("does not match Java against JavaScript", () => {
    expect(semanticMatch("Java", ["JavaScript"]).matched).toBe(false);
  });
});

describe("collectEvidence", () => {
  it("does not count a partial-word line as evidence", () => {
    const [go] = collectEvidence("Strong communicator with good judgement", ["Go"]);
    expect(go.supported).toBe(false);
  });

  it("finds evidence under the candidate's alias for a required skill", () => {
    const cv = "Ran production workloads on K8s across three regions";
    const [k8s] = collectEvidence(cv, ["Kubernetes"], new Map([["Kubernetes", ["K8s"]]]));
    expect(k8s.supported).toBe(true);
  });

  it("doesn't read 'led' inside 'called' as a high-confidence verb", () => {
    const [react] = collectEvidence("React component library called Atlas", ["React"]);
    expect(react.evidence[0].confidence).not.toBe("High");
  });
});

describe("applyKnockouts", () => {
  const job = (field, value) => ({ knockout_requirements: [{ field, value, required: true }] });

  it("passes a remote role regardless of candidate location", () => {
    const out = applyKnockouts({ location: "Leeds" }, job("location", "Remote (UK)"), 80);
    expect(out.failed).toHaveLength(0);
    expect(out.score).toBe(80);
  });

  it("leaves a location with no text overlap unverified instead of capping", () => {
    const out = applyKnockouts({ location: "London" }, job("location", "UK"), 80);
    expect(out.failed).toHaveLength(0);
    expect(out.unverified).toHaveLength(1);
    expect(out.score).toBe(80);
  });

  it("passes a certification written a different way", () => {
    const candidate = { certifications: [{ name: "AWS Solutions Architect - Associate" }] };
    const out = applyKnockouts(candidate, job("certification", "AWS Certified Solutions Architect"), 80);
    expect(out.failed).toHaveLength(0);
  });

  it("treats a certification the CV doesn't show as unconfirmed, whether or not others are listed", () => {
    // Listing other certificates used to turn this into a fail, so a
    // candidate who listed more was treated worse than one who listed none.
    for (const candidate of [{ certifications: [{ name: "PRINCE2 Foundation" }] }, { certifications: [] }]) {
      const out = applyKnockouts(candidate, job("certification", "CISSP"), 80);
      expect(out.failed).toHaveLength(0);
      expect(out.unverified).toHaveLength(1);
      expect(out.score).toBe(80);
    }
  });

  it("can't confirm minimum years from a CV with no dates, rather than failing it", () => {
    const out = applyKnockouts({ years_experience: 0, positions: [{ title: "Picker" }] }, job("min_years_experience", "2"), 75);
    expect(out.failed).toHaveLength(0);
    expect(out.unverified).toHaveLength(1);
    expect(out.score).toBe(75);
  });

  it("still fails minimum years when the dates show too few", () => {
    const out = applyKnockouts({ years_experience: 1, positions: [{ start_year: 2025 }] }, job("min_years_experience", "3"), 75);
    expect(out.failed).toHaveLength(1);
    expect(out.score).toBe(40);
  });

  it("uses relevant years for minimum experience when the judgement gave them", () => {
    const out = applyKnockouts({ years_experience: 12 }, job("min_years_experience", "5"), 75, { relevantYears: 2 });
    expect(out.failed).toHaveLength(1);
  });
});

describe("validateJob skill_importance", () => {
  it("keeps valid levels for required skills and drops the rest", () => {
    const job = validateJob({
      required_skills: ["Python", "SQL"],
      skill_importance: { python: "critical", SQL: "Huge", Excel: "High" },
    });
    expect(job.skill_importance).toEqual({ Python: "Critical" });
  });

  it("defaults to no weights for a job parsed before the field existed", () => {
    expect(validateJob({ required_skills: ["Python"] }).skill_importance).toEqual({});
  });
});
