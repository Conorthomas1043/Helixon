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
    expect(job.market_salary).toEqual({ low: 24000, high: 30000, currency: "GBP", period: "year" });
  });

  it("drops an implausible one", () => {
    expect(validateJob({ market_salary: { low: 50000, high: 20000 } }).market_salary).toBeNull();
    expect(validateJob({ market_salary: { low: 0, high: 0 } }).market_salary).toBeNull();
  });
});

describe("frontline roles", () => {
  it("parses an hourly rate and a frontline role type", () => {
    const job = validateJob({ role_type: "Frontline", market_salary: { low: 12.21, high: 13.5, currency: "GBP", period: "hour" } });
    expect(job.role_type).toBe("frontline");
    expect(job.market_salary).toEqual({ low: 12.21, high: 13.5, currency: "GBP", period: "hour" });
  });

  it("rejects an annual figure labelled hourly", () => {
    expect(validateJob({ market_salary: { low: 24000, high: 26000, period: "hour" } }).market_salary).toBeNull();
  });

  it("never turns physical or health requirements into knockouts", () => {
    const job = validateJob({
      knockout_requirements: [
        { field: "physical", value: "Able to lift 25kg" },
        { field: "fitness", value: "Must be physically fit" },
        { field: "driving_licence", value: "Full UK driving licence" },
      ],
    });
    expect(job.knockout_requirements.map((r) => r.field)).toEqual(["driving_licence"]);
  });

  it("uses what the CV states about right to work, transport and availability", () => {
    const candidate = { work_eligibility: ["Full UK right to work", "Own transport", "Available nights and weekends"] };
    const rules = [
      { field: "right_to_work", value: "UK right to work", required: true },
      { field: "own_transport", value: "Own transport", required: true },
      { field: "availability", value: "Weekends", required: true },
      { field: "availability", value: "Nights", required: true },
    ];
    const out = applyKnockouts(candidate, { knockout_requirements: rules }, 80);
    expect(out.failed).toHaveLength(0);
    expect(out.unverified).toHaveLength(0);
  });

  it("leaves unstated availability for the recruiter, never fails it", () => {
    const out = applyKnockouts({}, { knockout_requirements: [{ field: "availability", value: "Nights", required: true }] }, 80);
    expect(out.failed).toHaveLength(0);
    expect(out.unverified).toHaveLength(1);
  });

  it("matches warehouse and kitchen vocabulary", () => {
    expect(semanticMatch("Order picking", ["Pick and pack"]).matched).toBe(true);
    expect(semanticMatch("MHE", ["Reach truck"]).matched).toBe(true);
    expect(semanticMatch("Kitchen porter", ["Pot wash"]).matched).toBe(true);
    expect(semanticMatch("Delivery driving", ["Multi-drop"]).matched).toBe(true);
  });

  it("understands frontline titles", () => {
    expect(analyseProgression([{ title: "Shift Leader" }, { title: "Warehouse Operative" }]).progression).toBe("Positive");
    expect(analyseProgression([{ title: "Senior Carer" }, { title: "Care Assistant" }]).progression).toBe("Positive");
  });
});
