import { describe, expect, it } from "vitest";
import { AI_WRITING_MESSAGE, aiWritingNotice, normaliseAiWriting } from "./ai-writing";
import { buildReport } from "./analysis-report";
import validateCandidate from "@/lib/cv-analysis/validators/validateCandidate";

const clear = { likelihood: "high", signals: ["Stock phrasing in most bullets", "Achievements claimed with no figures or names"] };

describe("normaliseAiWriting", () => {
  it("keeps a known likelihood and up to four trimmed signs", () => {
    expect(normaliseAiWriting({ likelihood: " HIGH ", signals: [" a ", "", 3, "b", "c", "d", "e"] })).toEqual({ likelihood: "high", signals: ["a", "b", "c", "d"] });
  });

  it("treats anything unexpected as low", () => {
    expect(normaliseAiWriting(null)).toEqual({ likelihood: "low", signals: [] });
    expect(normaliseAiWriting({ likelihood: "certain", signals: "lots" })).toEqual({ likelihood: "low", signals: [] });
  });
});

describe("aiWritingNotice", () => {
  it("speaks up only for a clear case: high, with at least two named signs", () => {
    expect(aiWritingNotice({ ai_writing: clear })).toEqual({ message: AI_WRITING_MESSAGE, signals: clear.signals });
    expect(aiWritingNotice({ ai_writing: { likelihood: "high", signals: ["one sign"] } })).toBeNull();
    expect(aiWritingNotice({ ai_writing: { ...clear, likelihood: "medium" } })).toBeNull();
    // CVs read before the check existed have no ai_writing at all.
    expect(aiWritingNotice({})).toBeNull();
    expect(aiWritingNotice(null)).toBeNull();
  });

  it("is a prompt to check, not a reason to reject", () => {
    expect(AI_WRITING_MESSAGE).toMatch(/not a reason to turn anyone down/);
  });
});

describe("in the report", () => {
  it("buildReport carries the notice, including on a blind screen", () => {
    expect(buildReport({ match_score: 70 }, { name: "Jo Bloggs", ai_writing: clear }).ai_writing).toEqual({ message: AI_WRITING_MESSAGE, signals: clear.signals });
    expect(buildReport({ match_score: 70 }, { name: "Jo Bloggs", ai_writing: clear }, { blind: true }).ai_writing?.signals).toEqual(clear.signals);
    expect(buildReport({ match_score: 70 }, { name: "Jo Bloggs" }).ai_writing).toBeNull();
  });

  it("the CV reader's output is tidied on the way in", () => {
    expect(validateCandidate({ name: "Jo", ai_writing: { likelihood: "High", signals: ["x", "y"] } }).ai_writing).toEqual({ likelihood: "high", signals: ["x", "y"] });
    expect(validateCandidate({ name: "Jo" }).ai_writing).toEqual({ likelihood: "low", signals: [] });
  });
});
