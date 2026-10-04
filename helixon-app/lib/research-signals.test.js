import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const { scrubFreeText } = await import("./research-signals");

describe("scrubFreeText", () => {
  it("removes emails, phone numbers and links", () => {
    expect(scrubFreeText("Mail jo.bloggs@agency.co.uk or call +44 7700 900123, see https://x.io/a")).toBe(
      "Mail [email] or call [phone], see [link]"
    );
  });
  it("keeps ordinary text and numbers like prices", () => {
    expect(scrubFreeText("Is it £249 for 5 users?")).toBe("Is it £249 for 5 users?");
  });
  it("returns null for empty input and truncates long text", () => {
    expect(scrubFreeText("   ")).toBeNull();
    expect(scrubFreeText("a".repeat(50), 10)).toHaveLength(10);
  });
});
