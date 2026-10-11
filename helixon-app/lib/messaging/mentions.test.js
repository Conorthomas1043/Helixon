import { describe, expect, it } from "vitest";
import { findMentions } from "./mentions";

const team = [
  { id: "a", name: "Sam Lee" },
  { id: "b", name: "Sam Patel" },
  { id: "c", name: "Ana Smith" },
];

describe("findMentions", () => {
  it("finds full names and unique first names", () => {
    expect(findMentions("@Ana can you call her? cc @sam lee", team)).toEqual(["a", "c"]);
  });
  it("ignores a first name two people share, and partial words", () => {
    expect(findMentions("@Sam please", team)).toEqual([]);
    expect(findMentions("@Anastasia", team)).toEqual([]);
    expect(findMentions("email ana@example.com", team)).toEqual([]);
  });
});
