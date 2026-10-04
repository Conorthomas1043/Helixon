import { describe, expect, it } from "vitest";
import { agoLabel, daysInStage, lastContact, linkedinUrl } from "./insights";

const now = Date.parse("2026-10-10T12:00:00Z");

describe("candidate insights", () => {
  it("finds the latest contact", () => {
    const a = [
      { type: "note_added", timestamp: "2026-10-09T10:00:00Z" },
      { type: "call_logged", timestamp: "2026-10-05T10:00:00Z" },
      { type: "email_received", timestamp: "2026-10-07T10:00:00Z" },
    ];
    expect(lastContact(a)).toEqual({ at: Date.parse("2026-10-07T10:00:00Z"), type: "email_received" });
    expect(lastContact([])).toBeNull();
  });

  it("counts days in the current stage from the last move into it", () => {
    const c = {
      stage: "Interview",
      createdAt: "2026-09-01T00:00:00Z",
      activity: [
        { type: "stage_changed", meta: { to: "Shortlisted" }, timestamp: "2026-09-20T00:00:00Z" },
        { type: "stage_changed", meta: { to: "Interview" }, timestamp: "2026-10-03T12:00:00Z" },
      ],
    };
    expect(daysInStage(c, now)).toBe(7);
    expect(daysInStage({ ...c, stage: "Screened" }, now)).toBe(39);
    expect(daysInStage({ stage: null }, now)).toBeNull();
  });

  it("says how long ago", () => {
    expect(agoLabel(now - 1000, now)).toBe("today");
    expect(agoLabel(now - 86400000 * 1.5, now)).toBe("yesterday");
    expect(agoLabel(now - 86400000 * 12, now)).toBe("12 days ago");
    expect(agoLabel(now - 86400000 * 70, now)).toBe("2 months ago");
  });

  it("turns any form of LinkedIn into a link", () => {
    expect(linkedinUrl("https://www.linkedin.com/in/ana")).toBe("https://www.linkedin.com/in/ana");
    expect(linkedinUrl("linkedin.com/in/ana")).toBe("https://linkedin.com/in/ana");
    expect(linkedinUrl("ana-smith")).toBe("https://www.linkedin.com/in/ana-smith");
    expect(linkedinUrl("https://evil.example.com")).toBeNull();
    expect(linkedinUrl("")).toBeNull();
  });
});
