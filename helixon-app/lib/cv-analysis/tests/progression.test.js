import { describe, it, expect } from "vitest";
import { analyseProgression } from "../scoring/progressionEngine.js";

// positions are most-recent-first, matching how the rest of the pipeline
// passes them (see fitJudgeEngine.js's heuristicFallback).
describe("analyseProgression", () => {
  it("scores a move to a more senior title as Positive", () => {
    const result = analyseProgression([{ title: "Lead Developer" }, { title: "Developer" }]);
    expect(result.progression).toBe("Positive");
    expect(result.score).toBe(100);
  });

  it("scores a move to a less senior title as Regression", () => {
    const result = analyseProgression([{ title: "Developer" }, { title: "Lead Developer" }]);
    expect(result.progression).toBe("Regression");
    expect(result.score).toBe(20);
  });

  it("scores two same-level titles as Static", () => {
    const result = analyseProgression([{ title: "Developer" }, { title: "Developer" }]);
    expect(result.progression).toBe("Static");
    expect(result.score).toBe(60);
  });

  it("returns Unknown with a neutral score for fewer than 2 positions", () => {
    expect(analyseProgression([{ title: "Developer" }])).toEqual({ progression: "Unknown", score: 50 });
    expect(analyseProgression([])).toEqual({ progression: "Unknown", score: 50 });
  });
});
