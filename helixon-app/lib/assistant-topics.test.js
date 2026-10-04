import { describe, expect, it } from "vitest";
import { questionTopic } from "./assistant-topics";

describe("questionTopic", () => {
  it("tags common buying questions", () => {
    expect(questionTopic("How much is the agency plan per month?")).toBe("price");
    expect(questionTopic("Where is candidate data stored?")).toBe("data_privacy");
    expect(questionTopic("Is the scoring biased?")).toBe("scoring");
    expect(questionTopic("Does it work with Bullhorn?")).toBe("integrations");
    expect(questionTopic("Hello there")).toBe("other");
  });
});
