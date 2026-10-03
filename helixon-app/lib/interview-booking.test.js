import { describe, expect, it } from "vitest";
import { cleanBookingRequest, openSlots } from "./interview-booking";

const now = Date.parse("2026-10-03T12:00:00Z");

describe("cleanBookingRequest", () => {
  it("sorts and de-duplicates the times and sets an expiry", () => {
    const r = cleanBookingRequest({ slots: ["2026-10-08T14:00:00Z", "2026-10-06T09:00:00Z", "2026-10-08T14:00:00.000Z"], durationMinutes: 45, kind: "phone", round: "2" }, now);
    expect(r.slots).toEqual(["2026-10-06T09:00:00.000Z", "2026-10-08T14:00:00.000Z"]);
    expect(r).toMatchObject({ duration_minutes: 45, kind: "phone", round: 2, expires_at: "2026-10-08T14:00:00.000Z" });
  });
  it("expires after the given days if that's sooner than the last time", () => {
    const r = cleanBookingRequest({ slots: ["2026-11-20T09:00:00Z"], expiresInDays: 3 }, now);
    expect(r.expires_at).toBe("2026-10-06T12:00:00.000Z");
  });
  it("refuses past, empty or silly offers", () => {
    expect(cleanBookingRequest({ slots: [] }, now).error).toBeTruthy();
    expect(cleanBookingRequest({ slots: ["2026-10-01T09:00:00Z"] }, now).error).toMatch("future");
    expect(cleanBookingRequest({ slots: ["nope"] }, now).error).toBeTruthy();
    expect(cleanBookingRequest({ slots: ["2026-10-06T09:00:00Z"], durationMinutes: 2 }, now).error).toBeTruthy();
  });
});

describe("openSlots", () => {
  const link = { status: "open", expires_at: "2026-10-10T00:00:00Z", slots: ["2026-10-03T09:00:00Z", "2026-10-06T09:00:00Z"] };
  it("offers only future times on an open link", () => {
    expect(openSlots(link, now)).toEqual(["2026-10-06T09:00:00Z"]);
    expect(openSlots({ ...link, status: "booked" }, now)).toEqual([]);
    expect(openSlots(link, Date.parse("2026-10-11T00:00:00Z"))).toEqual([]);
  });
});
