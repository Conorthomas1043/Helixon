import { describe, expect, it } from "vitest";
import { headingKey, parseCvSections, resolveSection, sectionRange } from "./cvSections";

describe("headingKey", () => {
  it("recognises common heading styles", () => {
    expect(headingKey("Work Experience")).toBe("experience");
    expect(headingKey("EMPLOYMENT HISTORY:")).toBe("experience");
    expect(headingKey("Professional Summary")).toBe("profile");
    expect(headingKey("Core Skills")).toBe("skills");
    expect(headingKey("Key Strengths")).toBe("strengths");
    expect(headingKey("Education & Training")).toBe("education");
    expect(headingKey("Certifications")).toBe("certifications");
    expect(headingKey("— LANGUAGES —")).toBe("languages");
    expect(headingKey("Contact Details")).toBe("contact");
    expect(headingKey("References available on request")).toBe("references");
  });

  it("ignores sentences, bullets and contact lines", () => {
    expect(headingKey("experience with Salesforce and HubSpot")).toBeNull();
    expect(headingKey("Managed a team with strong skills in negotiation.")).toBeNull();
    expect(headingKey("5 years of experience in B2B sales across three regions")).toBeNull();
    expect(headingKey("jane@example.com")).toBeNull();
    expect(headingKey("")).toBeNull();
  });
});

const CV = `Jane Doe
Leeds · jane@example.com · 07700 900123
linkedin.com/in/janedoe

Professional Summary
Commercial leader with 9 years in B2B sales.

Core Skills
Negotiation, forecasting, Salesforce

Work Experience
Sales Manager, Acme (2019 - present)
- Grew revenue by 32%

Education
BA Economics, University of Leeds`;

describe("parseCvSections", () => {
  const parsed = parseCvSections(CV);

  it("anchors each section at its heading", () => {
    expect(parsed.lines[parsed.anchors.profile]).toBe("Professional Summary");
    expect(parsed.lines[parsed.anchors.skills]).toBe("Core Skills");
    expect(parsed.lines[parsed.anchors.experience]).toBe("Work Experience");
    expect(parsed.lines[parsed.anchors.education]).toBe("Education");
  });

  it("finds contact details without a heading", () => {
    expect(parsed.anchors.contact).toBe(1);
    expect([...parsed.contactLines]).toEqual([1, 2]);
  });

  it("falls back for Strengths when there's no such heading", () => {
    expect(resolveSection(parsed, "strengths")).toEqual({ line: parsed.anchors.skills, key: "skills" });
    expect(resolveSection(parsed, "languages")).toBeNull();
  });

  it("spans a section to the next heading", () => {
    const range = sectionRange(parsed, parsed.anchors.experience);
    expect(parsed.lines[range.start]).toBe("Work Experience");
    expect(parsed.lines[range.end + 1]).toBe("Education");
  });
});
