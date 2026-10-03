import { describe, expect, it } from "vitest";
import { cleanPortalUpdate, portalView } from "./candidate-portal";

describe("cleanPortalUpdate", () => {
  it("only updates what changed, and says what", () => {
    const current = { phone: "0700", location: "Leeds", notice_period: null };
    expect(cleanPortalUpdate({ phone: "0700", location: "York", noticePeriod: "1 month", availableFrom: "2026-11-01" }, current)).toEqual({
      update: { location: "York", notice_period: "1 month", available_from: "2026-11-01" },
      changed: ["Location", "Notice period", "Available from"],
    });
  });
  it("clears a field and ignores unknown ones", () => {
    expect(cleanPortalUpdate({ phone: "", email: "x@y.z", stage: "Placed" }, { phone: "0700" })).toEqual({ update: { phone: null }, changed: ["Phone"] });
  });
  it("refuses a bad date", () => {
    expect(cleanPortalUpdate({ availableFrom: "soon" }).error).toBeTruthy();
  });
});

describe("portalView", () => {
  it("shows the editable fields only", () => {
    const view = portalView({ phone: "0700", stage: "Interview", match_score: 80, salary_expectation: "£50k" });
    expect(view).toMatchObject({ phone: "0700", salaryExpectation: "£50k", availableFrom: "" });
    expect(view.stage).toBeUndefined();
    expect(view.match_score).toBeUndefined();
  });
});
