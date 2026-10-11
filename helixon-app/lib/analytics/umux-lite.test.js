import { describe, expect, it } from "vitest";
import { umuxLiteScore } from "./umux-lite";

describe("umuxLiteScore", () => {
  it("scores the 7-point items onto 0-100", () => {
    expect(umuxLiteScore(1, 1)).toBe(0);
    expect(umuxLiteScore(7, 7)).toBe(100);
    expect(umuxLiteScore(4, 4)).toBe(50);
    expect(umuxLiteScore(6, 5)).toBe(75);
  });
  it("rejects out-of-range or missing answers", () => {
    expect(umuxLiteScore(0, 4)).toBeNull();
    expect(umuxLiteScore(4, 8)).toBeNull();
    expect(umuxLiteScore(4.5, 4)).toBeNull();
    expect(umuxLiteScore(undefined, 4)).toBeNull();
  });
});
