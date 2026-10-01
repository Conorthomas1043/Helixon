import { describe, expect, it } from "vitest";
import { cleanCustomisation, cleanFieldValues, fieldsFor, formatFieldValue, normaliseCustomisation, subStagesFor } from "@/lib/custom-fields";

describe("cleanCustomisation", () => {
  it("gives new items ids from their labels, unique, and keeps existing ids", () => {
    const r = cleanCustomisation({
      subStages: [
        { label: "1st interview", stage: "Interview" },
        { label: "1st  interview!", stage: "Interview" },
        { id: "final", label: "Final round", stage: "Interview" },
      ],
      customFields: [{ label: "Notice period", type: "text", entity: "candidate" }],
    });
    expect(r.subStages.map((s) => s.id)).toEqual(["1st_interview", "1st_interview_2", "final"]);
    expect(r.subStages[1].label).toBe("1st interview!");
    expect(r.customFields[0]).toEqual({ id: "notice_period", label: "Notice period", type: "text", entity: "candidate" });
  });

  it("rejects a sub-stage without a real stage, a field without a type, and a list with no options", () => {
    expect(cleanCustomisation({ subStages: [{ label: "X", stage: "Nope" }] }).error).toMatch(/stage/);
    expect(cleanCustomisation({ customFields: [{ label: "X", type: "blob", entity: "job" }] }).error).toMatch(/type/);
    expect(cleanCustomisation({ customFields: [{ label: "X", type: "select", entity: "job", options: " \n " }] }).error).toMatch(/options/);
  });

  it("splits and de-duplicates list options", () => {
    const r = cleanCustomisation({ customFields: [{ label: "Clearance", type: "select", entity: "candidate", options: "SC\nDV\nSC\n" }] });
    expect(r.customFields[0].options).toEqual(["SC", "DV"]);
  });

  it("drops blank labels", () => {
    expect(cleanCustomisation({ subStages: [{ label: "  ", stage: "Offer" }] }).subStages).toEqual([]);
  });
});

describe("normaliseCustomisation", () => {
  it("is empty without settings and drops malformed entries", () => {
    expect(normaliseCustomisation(null)).toEqual({ subStages: [], customFields: [] });
    const n = normaliseCustomisation({ customisation: { subStages: [{ id: "a", label: "A", stage: "Offer" }, { id: "b", label: "B", stage: "Zzz" }] } });
    expect(n.subStages).toHaveLength(1);
    expect(subStagesFor(n.subStages, "Offer")).toHaveLength(1);
    expect(subStagesFor(n.subStages, "Placed")).toHaveLength(0);
  });
});

describe("cleanFieldValues", () => {
  const defs = [
    { id: "notice", label: "Notice", type: "number", entity: "candidate" },
    { id: "avail", label: "Available", type: "date", entity: "candidate" },
    { id: "clear", label: "Clearance", type: "select", entity: "candidate", options: ["SC", "DV"] },
    { id: "car", label: "Driver", type: "checkbox", entity: "candidate" },
    { id: "site", label: "Portfolio", type: "url", entity: "candidate" },
    { id: "budget", label: "Budget", type: "number", entity: "job" },
  ];

  it("validates by type, merges with current values and ignores other entities' fields", () => {
    const r = cleanFieldValues(defs, "candidate", { notice: "£1,000", avail: "2026-11-01", clear: "SC", car: true, site: "example.com/me", budget: 5 }, { old: 1 });
    expect(r.values).toEqual({ old: 1, notice: 1000, avail: "2026-11-01", clear: "SC", car: true, site: "https://example.com/me" });
  });

  it("removes a value when blanked", () => {
    expect(cleanFieldValues(defs, "candidate", { notice: "" }, { notice: 4 }).values).toEqual({});
  });

  it("refuses bad values", () => {
    expect(cleanFieldValues(defs, "candidate", { notice: "abc" }).error).toMatch(/number/);
    expect(cleanFieldValues(defs, "candidate", { avail: "31/12/2026" }).error).toMatch(/date/);
    expect(cleanFieldValues(defs, "candidate", { clear: "TS" }).error).toMatch(/options/);
    expect(cleanFieldValues(defs, "candidate", { site: "javascript:alert(1)" }).error).toMatch(/web address/);
  });

  it("formats values for display", () => {
    expect(formatFieldValue(defs[3], false)).toBe("No");
    expect(formatFieldValue(defs[1], "2026-11-01")).toBe("1 Nov 2026");
    expect(formatFieldValue(defs[0], 12000)).toBe("12,000");
    expect(fieldsFor(defs, "job")).toHaveLength(1);
  });
});
