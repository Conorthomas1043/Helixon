import { describe, it, expect } from "vitest";
import validateJob from "../validators/validateJob.js";
import { jobExtractionPrompt, MAX_JOB_CHARS } from "../prompts/jobExtractionPrompt.js";

describe("job skill lists", () => {
  it("drops sentence-length entries and duplicates, and caps the list", () => {
    const job = validateJob({
      required_skills: ["Python", "python", "x".repeat(151), ...Array.from({ length: 100 }, (_, i) => `Skill ${i}`)],
      preferred_skills: "SQL, SQL, dbt",
    });
    expect(job.required_skills[0]).toBe("Python");
    expect(job.required_skills.filter((s) => s.toLowerCase() === "python")).toHaveLength(1);
    expect(job.required_skills.some((s) => s.length > 150)).toBe(false);
    expect(job.required_skills).toHaveLength(60);
    expect(job.preferred_skills).toEqual(["SQL", "dbt"]);
  });

  it("drops a knockout on native-language requirements", () => {
    const job = validateJob({ knockout_requirements: [{ field: "language", value: "Native English speaker" }] });
    expect(job.knockout_requirements).toEqual([]);
  });
});

describe("job extraction prompt size", () => {
  it("keeps a full-length description inside askClaude's 40,000-character cut", () => {
    // app/api/run: 28,000-character description + 20 must-haves of 200.
    const mustHaves = Array.from({ length: 20 }, () => `- ${"m".repeat(200)}`).join("\n");
    const jobText = `${"j".repeat(28000)}\n\nAdditional must-have requirements specified by the recruiter:\n${mustHaves}`;
    expect(jobText.length).toBeLessThanOrEqual(MAX_JOB_CHARS);
    const prompt = jobExtractionPrompt(jobText);
    expect(prompt.length).toBeLessThanOrEqual(40000);
    expect(prompt).toContain("m".repeat(200));
  });
});
