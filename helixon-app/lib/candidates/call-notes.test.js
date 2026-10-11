import { describe, expect, it } from "vitest";
import { buildPrompt, cleanCallNotes, noteText } from "./call-notes";

describe("call notes", () => {
  it("builds a prompt with the context and the notes", () => {
    const p = buildPrompt({ notes: "Spoke to Ana, 1 month notice", candidateName: "Ana", jobTitle: "Dev", today: "2026-10-03" });
    expect(p).toContain("Today is 2026-10-03.");
    expect(p).toContain("phone call with Ana about the role Dev");
    expect(p).toContain("1 month notice");
  });

  it("keeps only usable, bounded output", () => {
    const r = cleanCallNotes({
      summary: " Keen, interviewing elsewhere. ",
      keyPoints: ["Notice 1 month", "", 3],
      nextSteps: ["Send CV to client"],
      followUp: { label: "Call back after Acme interview", inDays: 99 },
      details: { noticePeriod: "1 month", salaryExpectation: "£55k", availableFrom: "early Nov", otherProcesses: "Acme 2nd stage" },
    });
    expect(r).toEqual({
      summary: "Keen, interviewing elsewhere.",
      keyPoints: ["Notice 1 month"],
      nextSteps: ["Send CV to client"],
      followUp: { label: "Call back after Acme interview", inDays: 60 },
      details: { noticePeriod: "1 month", salaryExpectation: "£55k", availableFrom: "", otherProcesses: "Acme 2nd stage" },
    });
    expect(cleanCallNotes({ summary: "" })).toBeNull();
    expect(cleanCallNotes(null)).toBeNull();
  });

  it("writes the note for the profile", () => {
    const text = noteText({ summary: "Good call.", keyPoints: ["A"], nextSteps: [], followUp: null, details: { noticePeriod: "1 month", salaryExpectation: "", availableFrom: "", otherProcesses: "" } });
    expect(text).toBe("Call summary: Good call.\n\nKey points:\n- A\n\nNotice: 1 month");
  });
});
