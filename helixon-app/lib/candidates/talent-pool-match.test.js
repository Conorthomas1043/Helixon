import { describe, expect, it } from "vitest";
import { mentionsSkill, quickFit } from "./talent-pool-match";

describe("mentionsSkill", () => {
  const text = " sales manager used salesforce and c# daily. managed b2b accounts ";

  it("finds whole skills, case-insensitively", () => {
    expect(mentionsSkill(text, "Salesforce")).toBe(true);
    expect(mentionsSkill(text, "B2B accounts")).toBe(true);
    expect(mentionsSkill(text, "C#")).toBe(true);
  });

  it("doesn't match inside other words", () => {
    expect(mentionsSkill(text, "Go")).toBe(false);
    expect(mentionsSkill(text, "R")).toBe(false);
    expect(mentionsSkill(text, "")).toBe(false);
  });
});

describe("quickFit", () => {
  const job = {
    requiredSkills: ["Salesforce", "Negotiation", "Team leadership"],
    preferredSkills: ["HubSpot"],
    minYearsExperience: 5,
  };

  it("weights required skills, experience and nice-to-haves", () => {
    const fit = quickFit(job, {
      cvText: "Led negotiation with enterprise clients. Salesforce admin.",
      skills: ["Team leadership"],
      yearsExperience: 8,
    });
    expect(fit.matched).toEqual(["Salesforce", "Negotiation", "Team leadership"]);
    expect(fit.missing).toEqual([]);
    expect(fit.experienceOk).toBe(true);
    expect(fit.fit).toBe(90);
  });

  it("lists what's missing and scales short experience", () => {
    const fit = quickFit(job, { cvText: "Salesforce", yearsExperience: 2 });
    expect(fit.missing).toEqual(["Negotiation", "Team leadership"]);
    expect(fit.experienceOk).toBe(false);
    expect(fit.fit).toBe(27);
  });

  it("has no score when the job has nothing to compare", () => {
    expect(quickFit({}, { cvText: "anything" }).fit).toBeNull();
  });

  it("accepts skills given as objects", () => {
    const fit = quickFit({ requiredSkills: [{ name: "Python" }] }, { cvText: "python and sql" });
    expect(fit.fit).toBe(100);
  });
});
