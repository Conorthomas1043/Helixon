import { describe, it, expect, vi } from "vitest";
import { semanticMatch } from "../scoring/semanticMatcher.js";
import { applyKnockouts } from "../scoring/knockoutEngine.js";
import { analyseProgression } from "../scoring/progressionEngine.js";
import { collectEvidence } from "../scoring/evidenceEngine.js";
import validateJob from "../validators/validateJob.js";

describe("skill synonyms outside tech", () => {
  it("matches common non-tech synonyms", () => {
    expect(semanticMatch("Cold calling", ["Telesales"]).matched).toBe(true);
    expect(semanticMatch("Stock control", ["Inventory management"]).matched).toBe(true);
    expect(semanticMatch("Team leadership", ["Line management"]).matched).toBe(true);
    expect(semanticMatch("Customer service", ["Customer care"]).matched).toBe(true);
  });

  it("lets a tool satisfy its broader skill, but not a sibling tool", () => {
    expect(semanticMatch("CRM", ["Salesforce"]).matched).toBe(true);
    expect(semanticMatch("HubSpot", ["Salesforce"]).matched).toBe(false);
    expect(semanticMatch("Salesforce", ["CRM"]).matched).toBe(false);
    expect(semanticMatch("Flask", ["Django"]).matched).toBe(false);
  });
});

describe("evidence verbs outside tech", () => {
  it("treats sales and care achievements as strong evidence", () => {
    const [neg] = collectEvidence("Negotiated supplier contracts worth £2m", ["Negotiation"], new Map([["Negotiation", ["negotiated"]]]));
    expect(neg.supported).toBe(true);
    expect(neg.evidence[0].confidence).toBe("High");
  });
});

describe("knockouts for non-tech credentials", () => {
  const job = (field, value) => ({ knockout_requirements: [{ field, value, required: true }] });

  it("passes a driving licence the CV states, and never fails one it doesn't", () => {
    const withLicence = { certifications: [{ name: "Full UK driving licence" }] };
    expect(applyKnockouts(withLicence, job("driving_licence", "Full UK driving licence"), 80).failed).toHaveLength(0);
    const silent = applyKnockouts({}, job("Driving License", "Full UK driving licence"), 80);
    expect(silent.failed).toHaveLength(0);
    expect(silent.unverified).toHaveLength(1);
  });

  it("passes a DBS check or registration the CV states", () => {
    const c = { certifications: [{ name: "Enhanced DBS" }, { name: "NMC registration" }] };
    expect(applyKnockouts(c, job("background_check", "Enhanced DBS"), 80).unverified).toHaveLength(0);
    expect(applyKnockouts(c, job("license", "NMC registration"), 80).unverified).toHaveLength(0);
  });

  it("matches a degree subject whatever the degree is called", () => {
    const c = { education: [{ degree: "BSc", field_of_study: "Adult Nursing" }] };
    expect(applyKnockouts(c, job("education", "Degree in Nursing"), 80).unverified).toHaveLength(0);
    expect(applyKnockouts(c, job("education", "Degree"), 80).unverified).toHaveLength(0);
    expect(applyKnockouts({}, job("education", "Degree in Law"), 80).failed).toHaveLength(0);
  });

  it("doesn't fail a certification when the CV lists none at all", () => {
    expect(applyKnockouts({ certifications: [] }, job("certification", "Care Certificate"), 80).failed).toHaveLength(0);
  });
});

describe("fallback career progression", () => {
  it("understands non-tech titles", () => {
    expect(analyseProgression([{ title: "Store Manager" }, { title: "Sales Assistant" }]).progression).toBe("Positive");
    expect(analyseProgression([{ title: "Ward Sister" }, { title: "Staff Nurse" }]).progression).toBe("Positive");
    expect(analyseProgression([{ title: "Nurse" }, { title: "Nurse" }]).progression).toBe("Static");
    expect(analyseProgression([{ title: "Sales Assistant" }, { title: "Assistant Manager" }]).progression).toBe("Regression");
  });
});

describe("validateJob", () => {
  it("keeps a plausible market salary and job family", () => {
    const job = validateJob({ job_family: "Healthcare", market_salary: { low: "24000", high: 30000, currency: "gbp" } });
    expect(job.job_family).toBe("healthcare");
    expect(job.market_salary).toEqual({ low: 24000, high: 30000, currency: "GBP" });
  });

  it("drops an implausible one", () => {
    expect(validateJob({ market_salary: { low: 50000, high: 20000 } }).market_salary).toBeNull();
    expect(validateJob({ market_salary: { low: 0, high: 0 } }).market_salary).toBeNull();
  });
});
