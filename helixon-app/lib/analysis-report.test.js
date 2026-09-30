import { describe, it, expect } from "vitest";
import { buildReport } from "./analysis-report.js";

describe("buildReport text lists", () => {
  it("turns stored objects into text the report can render", () => {
    const report = buildReport({
      interview_questions: ["Can you explain SQL?", { text: "Walk me through Python" }, null, 7],
      red_flags: [{ flag: "Expired licence", detail: "2019" }],
      strengths: "not a list",
    });
    expect(report.interview_questions).toEqual(["Can you explain SQL?", "Walk me through Python"]);
    expect(report.red_flags).toEqual(["Expired licence"]);
    expect(report.strengths).toEqual([]);
    expect(report.weaknesses).toEqual([]);
  });

  it("caps the questions shown for results stored before the cap existed", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Question ${i}?`);
    expect(buildReport({ interview_questions: many }).interview_questions).toHaveLength(8);
  });

  it("keeps ordinary strings as they are", () => {
    const long = `A ${"very ".repeat(100)}long strength`;
    expect(buildReport({ strengths: [long] }).strengths).toEqual([long]);
  });
});
