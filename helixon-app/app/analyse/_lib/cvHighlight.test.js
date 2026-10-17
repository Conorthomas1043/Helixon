import { describe, expect, it } from "vitest";
import { highlightSegments, quoteRanges } from "./cvHighlight";

const CV = "Jane Doe\nShift lead\nPicked 1,200 lines a shift\non RF scanners.\nRan weekly stock counts across three aisles and reported variances to the site manager.";

describe("quoteRanges", () => {
  it("finds a quote across line breaks and case", () => {
    const [r] = quoteRanges(CV, [{ skill: "Picking", quote: "picked 1,200 lines a shift on RF scanners" }]);
    expect(CV.slice(r.start, r.end)).toBe("Picked 1,200 lines a shift\non RF scanners");
    expect(r.skill).toBe("Picking");
  });

  it("falls back to the first words when the end of the quote was paraphrased", () => {
    const [r] = quoteRanges(CV, [{ skill: "Stock", quote: "Ran weekly stock counts across three aisles, reporting to management" }]);
    expect(CV.slice(r.start, r.end)).toBe("Ran weekly stock counts across three");
  });

  it("leaves out quotes it can't place and keeps reading order without overlaps", () => {
    const ranges = quoteRanges(CV, [
      { skill: "Stock", quote: "Ran weekly stock counts" },
      { skill: "Forklift", quote: "Counterbalance licence" },
      { skill: "Lead", quote: "Shift lead" },
      { skill: "Counts", quote: "stock counts" },
    ]);
    expect(ranges.map((r) => r.skill)).toEqual(["Lead", "Stock"]);
  });

  it("copes with no text or no quotes", () => {
    expect(quoteRanges("", [{ skill: "x", quote: "y" }])).toEqual([]);
    expect(quoteRanges(CV, [])).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("cuts the text into plain and highlighted pieces that join back up", () => {
    const ranges = quoteRanges(CV, [{ skill: "Lead", quote: "Shift lead" }]);
    const parts = highlightSegments(CV, ranges);
    expect(parts.map((p) => p.text).join("")).toBe(CV);
    expect(parts.filter((p) => p.skill)).toEqual([{ text: "Shift lead", skill: "Lead" }]);
  });
});
