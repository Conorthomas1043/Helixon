import { describe, expect, it } from "vitest";
import { smsHref, telHref, toE164, whatsappHref } from "@/lib/phone";

describe("toE164", () => {
  it("handles UK numbers written the usual ways", () => {
    expect(toE164("07700 900123")).toBe("+447700900123");
    expect(toE164("+44 7700 900123")).toBe("+447700900123");
    expect(toE164("+44 (0)7700 900123")).toBe("+447700900123");
    expect(toE164("0044 7700 900123")).toBe("+447700900123");
    expect(toE164("020 7946 0958")).toBe("+442079460958");
    expect(toE164("447700900123")).toBe("+447700900123");
  });
  it("keeps other countries' international numbers and drops extensions", () => {
    expect(toE164("+1 (415) 555-0100")).toBe("+14155550100");
    expect(toE164("+353 87 123 4567")).toBe("+353871234567");
    expect(toE164("020 7946 0958 ext. 12")).toBe("+442079460958");
  });
  it("refuses what isn't a number", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("call me")).toBeNull();
    expect(toE164("12345")).toBeNull();
  });
});

describe("links", () => {
  it("builds tel, sms and WhatsApp links", () => {
    expect(telHref("07700 900123")).toBe("tel:+447700900123");
    expect(smsHref("07700 900123", "Hi Sam")).toBe("sms:+447700900123?&body=Hi%20Sam");
    expect(whatsappHref("07700 900123", "Hi Sam")).toBe("https://wa.me/447700900123?text=Hi%20Sam");
    expect(whatsappHref("nope")).toBeNull();
  });
});
