import { describe, expect, it } from "vitest";
import { cleanSequenceSteps, stepDueAt, stopReason } from "./sequences";

describe("cleanSequenceSteps", () => {
  it("validates steps", () => {
    expect(cleanSequenceSteps([]).error).toBeTruthy();
    expect(cleanSequenceSteps([{ delayDays: 0, subject: "Hi", body: "" }]).error).toMatch(/subject and a message/);
    expect(cleanSequenceSteps([{ delayDays: -1, subject: "Hi", body: "x" }]).error).toMatch(/0–90/);
    expect(cleanSequenceSteps([{ delayDays: "3", subject: " Hi ", body: "Body" }])).toEqual({ steps: [{ delayDays: 3, subject: "Hi", body: "Body" }] });
  });
});

describe("stepDueAt", () => {
  it("adds the step's delay", () => {
    const steps = [{ delayDays: 0 }, { delayDays: 3 }];
    expect(stepDueAt(steps, 1, "2026-10-01T09:00:00Z")).toBe("2026-10-04T09:00:00.000Z");
    expect(stepDueAt(steps, 2, "2026-10-01T09:00:00Z")).toBeNull();
  });
});

describe("stopReason", () => {
  it("stops at final stages or without an email", () => {
    expect(stopReason({ email: "a@b.co", stage: "Interview" })).toBeNull();
    expect(stopReason({ email: "a@b.co", stage: "Placed" })).toBe("Placed");
    expect(stopReason({ email: null })).toBe("No email address");
    expect(stopReason(null)).toBe("Candidate removed");
  });
});
