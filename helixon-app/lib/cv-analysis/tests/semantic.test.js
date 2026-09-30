import { describe, it, expect } from "vitest";
import { semanticMatch } from "../scoring/semanticMatcher.js";

describe("semanticMatch", () => {
  it("matches a required skill against a taxonomy alias the candidate listed", () => {
    expect(semanticMatch("React", ["NextJS"]).matched).toBe(true);
    expect(semanticMatch("AWS", ["Lambda"]).matched).toBe(true);
  });

  it("matches an exact (case-insensitive) skill name", () => {
    const result = semanticMatch("React", ["react"]);
    expect(result.matched).toBe(true);
    expect(result.exact).toBe(true);
  });

  it("does not match unrelated skills", () => {
    expect(semanticMatch("React", ["Cobol"]).matched).toBe(false);
  });
});

describe("whole-word fallback limits", () => {
  it("doesn't match one- or two-letter skills inside longer ones", () => {
    expect(semanticMatch("C", ["Objective-C"]).matched).toBe(false);
    expect(semanticMatch("Go", ["Go-to-market strategy"]).matched).toBe(false);
    expect(semanticMatch("Go", ["Go"]).matched).toBe(true);
  });

  it("doesn't let a generic single word match any specialism", () => {
    expect(semanticMatch("Management", ["Project Management"]).matched).toBe(false);
    expect(semanticMatch("Excel", ["Microsoft Excel"]).matched).toBe(true);
  });
});
