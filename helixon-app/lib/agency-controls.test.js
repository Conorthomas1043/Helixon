import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { capRefusal, startOfMonthUtc } = await import("./agency-controls");

describe("capRefusal", () => {
  it("allows screening when there is no cap or it isn't reached", () => {
    expect(capRefusal(500, null)).toBe(null);
    expect(capRefusal(9, 10)).toBe(null);
  });

  it("refuses at the cap", () => {
    const r = capRefusal(10, 10);
    expect(r.status).toBe(429);
    expect(r.error).toMatch(/limit of 10/);
  });
});

describe("startOfMonthUtc", () => {
  it("is midnight on the 1st, UTC", () => {
    expect(startOfMonthUtc(new Date("2026-09-29T23:30:00Z"))).toBe("2026-09-01T00:00:00.000Z");
  });
});
