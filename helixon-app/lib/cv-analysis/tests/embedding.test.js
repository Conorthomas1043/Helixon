import { describe, it, expect } from "vitest";
import { findSemanticMatch, isDistinctPair } from "../scoring/embeddingMatcher.js";

describe("embedding matches", () => {
  // Identical vectors: similarity 1, so only the distinct-pair list can stop a match.
  const same = [1, 0, 0];
  const embeddings = new Map([["java", same], ["javascript", same], ["golang", same]]);

  it("never matches skills known not to be substitutes, however close the vectors", () => {
    expect(isDistinctPair("JavaScript", "java")).toBe(true);
    expect(findSemanticMatch("Java", ["JavaScript"], embeddings)).toBeNull();
  });

  it("still matches other close skills", () => {
    expect(findSemanticMatch("Java", ["Golang"], embeddings)).toEqual({ matched: "Golang", score: 1 });
  });
});
