import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { cleanClientFields, cleanContactFields, toClient } = await import("./clients");

describe("cleanClientFields", () => {
  it("maps fields to columns and only includes what was sent", () => {
    expect(cleanClientFields({ name: " Acme ", feePercent: "18.5", paymentTermsDays: "30" })).toEqual({
      name: "Acme",
      fee_percent: 18.5,
      payment_terms_days: 30,
    });
    expect(cleanClientFields({ industry: "Fintech" })).toEqual({ industry: "Fintech" });
  });

  it("requires a name when creating", () => {
    expect(cleanClientFields({}, { requireName: true }).error).toBeTruthy();
    expect(cleanClientFields({ name: "  " }).error).toBeTruthy();
  });

  it("validates terms", () => {
    expect(cleanClientFields({ feePercent: 120 }).error).toMatch(/percentage/);
    expect(cleanClientFields({ rebateDays: -1 }).error).toMatch(/Rebate/);
    expect(cleanClientFields({ feePercent: "" })).toEqual({ fee_percent: null });
    expect(cleanClientFields({ status: "gone" }).error).toBeTruthy();
  });
});

describe("cleanContactFields", () => {
  it("validates email and clears empty values", () => {
    expect(cleanContactFields({ name: "Jo", email: "JO@Acme.com" }, { requireName: true })).toEqual({ name: "Jo", email: "jo@acme.com" });
    expect(cleanContactFields({ email: "nope" }).error).toBeTruthy();
    expect(cleanContactFields({ email: "" })).toEqual({ email: null });
    expect(cleanContactFields({ isPrimary: true })).toEqual({ is_primary: true });
  });
});

describe("toClient", () => {
  it("returns numbers for numeric columns", () => {
    expect(toClient({ id: "1", name: "A", fee_percent: "20.00" }).feePercent).toBe(20);
    expect(toClient({ id: "1", name: "A", fee_percent: null }).feePercent).toBeNull();
  });
});
