import { describe, expect, it } from "vitest";
import { timingSafeEqualStr } from "./timing-safe";

describe("timingSafeEqualStr", () => {
  it("matches identical strings", () => {
    expect(timingSafeEqualStr("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("rejects different strings of the same and different lengths", () => {
    expect(timingSafeEqualStr("abc", "abd")).toBe(false);
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
  });

  it("fails closed on empty or non-string input", () => {
    expect(timingSafeEqualStr("", "")).toBe(false);
    expect(timingSafeEqualStr(undefined, undefined)).toBe(false);
    expect(timingSafeEqualStr(null, "x")).toBe(false);
    expect(timingSafeEqualStr(123, "123")).toBe(false);
  });
});
