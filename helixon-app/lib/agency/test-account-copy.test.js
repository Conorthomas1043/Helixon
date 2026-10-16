import { describe, expect, it } from "vitest";
import { testAccountBannerText } from "./test-account-copy";

describe("testAccountBannerText", () => {
  it("names the last day of access", () => {
    expect(testAccountBannerText("2026-10-30T15:00:00.000Z")).toBe("Test account · access until 30 October 2026");
  });
  it("is just the label with no end date", () => {
    expect(testAccountBannerText(null)).toBe("Test account");
  });
});
