import { describe, expect, it } from "vitest";
import { matchCommands } from "./commands";

const ids = (q) => matchCommands(q).map((c) => c.id);

describe("matchCommands", () => {
  it("suggests the everyday actions before anything's typed", () => {
    expect(ids("")).toEqual(["screen", "bulk", "job"]);
  });

  it("matches the label and the words people use for it", () => {
    expect(ids("pipe")).toEqual(["go-pipeline"]);
    expect(ids("upload")).toContain("screen");
    expect(ids("invoices")).toEqual(["go-placements"]);
  });

  it("needs every word to match, and ranks title matches first", () => {
    expect(ids("screen batch")).toEqual(["bulk"]);
    expect(ids("screen")[0]).toBe("screen");
  });

  it("finds nothing for nonsense", () => {
    expect(ids("zzzz")).toEqual([]);
  });
});
