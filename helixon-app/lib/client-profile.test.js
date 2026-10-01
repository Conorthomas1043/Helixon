import { describe, expect, it } from "vitest";
import { blindLabel, buildClientProfile } from "./client-profile";

const candidate = {
  full_name: "Priya Shah",
  email: "priya@example.com",
  phone: "07700 900123",
  current_title: "Senior Engineer",
  current_company: "Globex",
  location: "Leeds",
  match_score: 84,
  match_summary: "Priya Shah has led platform teams at Globex for five years.",
  strengths: ["Led Globex's migration to Kubernetes"],
  concerns: ["No fintech experience"],
};
const extracted = {
  name: "Priya Shah",
  email: "priya@example.com",
  linkedin: "linkedin.com/in/priyashah",
  current_employer: "Globex",
  location: "Leeds",
  skills: ["Go", "Kubernetes"],
  positions: [{ title: "Senior Engineer", employer: "Globex", start_year: 2020, end_year: 0 }],
  education: [{ degree: "BSc", field_of_study: "Computer Science", institution: "University of Leeds", start_year: 2012, end_year: 2015 }],
  notice_period: "1 month",
};
const result = {
  matched_skills: ["Kubernetes"],
  requirements_met: [{ requirement: "skill: Go", status: "met", met: true }],
  interview_questions: ["Secret recruiter-only question"],
};

describe("buildClientProfile", () => {
  it("never includes the candidate's contact details or recruiter-only content", () => {
    const json = JSON.stringify(buildClientProfile({ candidate, extracted, result }));
    expect(json).not.toContain("priya@example.com");
    expect(json).not.toContain("07700");
    expect(json).not.toContain("linkedin.com");
    expect(json).not.toContain("Secret recruiter-only question");
  });

  it("leaves concerns out unless asked", () => {
    expect(buildClientProfile({ candidate, extracted, result }).concerns).toEqual([]);
    expect(buildClientProfile({ candidate, extracted, result }, { includeConcerns: true }).concerns).toEqual(["No fintech experience"]);
  });

  it("shows identity when not blind", () => {
    const p = buildClientProfile({ candidate, extracted, result });
    expect(p.name).toBe("Priya Shah");
    expect(p.currentEmployer).toBe("Globex");
    expect(p.positions[0]).toEqual({ title: "Senior Engineer", employer: "Globex", dates: "2020–present" });
    expect(p.education[0].institution).toBe("University of Leeds");
    expect(p.skills[0]).toBe("Kubernetes");
  });

  it("anonymises a blind profile, including free text", () => {
    const p = buildClientProfile({ candidate, extracted, result }, { blind: true, label: "Candidate B" });
    const json = JSON.stringify(p);
    expect(p.name).toBe("Candidate B");
    expect(json).not.toContain("Priya");
    expect(json).not.toContain("Globex");
    expect(json).not.toContain("Leeds");
    expect(p.positions[0].employer).toBe("Withheld");
    expect(p.education[0].institution).toBe("Withheld");
    expect(p.summary).toContain("[Candidate]");
  });
});

describe("blindLabel", () => {
  it("letters candidates in order", () => {
    expect(blindLabel(0)).toBe("Candidate A");
    expect(blindLabel(25)).toBe("Candidate Z");
    expect(blindLabel(26)).toBe("Candidate AA");
  });
});
