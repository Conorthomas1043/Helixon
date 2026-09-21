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
