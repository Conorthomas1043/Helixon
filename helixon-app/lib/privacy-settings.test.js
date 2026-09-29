import { describe, expect, it } from "vitest";
import { addMonths, deletionDate, normaliseSettings, retentionCutoff } from "./privacy-settings";

describe("normaliseSettings", () => {
  it("defaults to 12 months and presence on", () => {
    expect(normaliseSettings(null)).toEqual({ retentionMonths: 12, presenceEnabled: true });
  });
  it("only accepts the offered retention periods", () => {
    expect(normaliseSettings({ retention_months: 24, presence_enabled: false })).toEqual({ retentionMonths: 24, presenceEnabled: false });
    expect(normaliseSettings({ retention_months: 999 }).retentionMonths).toBe(12);
  });
});

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), -12).toISOString()).toBe("2025-03-15T00:00:00.000Z");
  });
});

describe("retention dates", () => {
  it("works out the cutoff and when someone will be deleted", () => {
    expect(retentionCutoff(12, new Date("2026-09-29T03:00:00Z")).toISOString()).toBe("2025-09-29T03:00:00.000Z");
    expect(deletionDate("2025-10-10T00:00:00Z", 12).toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });
});
