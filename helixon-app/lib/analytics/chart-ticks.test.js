import { describe, expect, it } from "vitest";
import { axisMoney, niceTicks } from "./chart-ticks";

describe("niceTicks", () => {
  it("steps by one for small counts, never skipping a value", () => {
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it("uses a 1-2-5 step and ends at or above the maximum", () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(4500)).toEqual([0, 2000, 4000, 6000]);
    expect(niceTicks(10)).toEqual([0, 5, 10]);
  });
});

describe("axisMoney", () => {
  it("keeps one decimal below £10k and whole thousands above", () => {
    expect(axisMoney(4500)).toBe("£4.5k");
    expect(axisMoney(4000)).toBe("£4k");
    expect(axisMoney(12500)).toBe("£13k");
    expect(axisMoney(800)).toBe("£800");
  });
});
