import { describe, it, expect } from "vitest";
import { isStage } from "./stage-labels.js";

describe("isStage", () => {
  it("accepts the pipeline stages", () => {
    for (const s of ["Screened", "Shortlisted", "Interview", "Offer", "Placed", "Rejected"]) expect(isStage(s)).toBe(true);
  });

  it("rejects inherited keys and anything else", () => {
    for (const s of ["constructor", "toString", "__proto__", "hasOwnProperty", "screened", "", null, undefined, 1, {}]) {
      expect(isStage(s)).toBe(false);
    }
  });
});
