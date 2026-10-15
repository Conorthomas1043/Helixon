import { describe, expect, it } from "vitest";
import { allowedCountryCodes, isStopMessage, normalisePhone, optedOut, smsDestinationAllowed, twilioSignature, verifyTwilioSignature } from "./sms";

describe("sms", () => {
  it("normalises phone numbers to E.164", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("+44 (0)7700-900-123")).toBe("+447700900123");
    expect(normalisePhone("0044 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalisePhone("0412 345 678", "61")).toBe("+61412345678");
    expect(normalisePhone("12")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
  });

  it("only texts allowed countries", () => {
    expect(allowedCountryCodes({})).toEqual(["44"]);
    expect(allowedCountryCodes({ SMS_DEFAULT_COUNTRY_CODE: "61" })).toEqual(["61"]);
    expect(allowedCountryCodes({ SMS_ALLOWED_COUNTRY_CODES: "44, +353, x" })).toEqual(["44", "353"]);
    expect(smsDestinationAllowed("+447700900123", {})).toBe(true);
    expect(smsDestinationAllowed("+881234567890", {})).toBe(false);
    expect(smsDestinationAllowed("+353851234567", { SMS_ALLOWED_COUNTRY_CODES: "44,353" })).toBe(true);
    expect(smsDestinationAllowed(null, {})).toBe(false);
  });

  it("spots opt-outs and opt-ins, newest first", () => {
    expect(isStopMessage("STOP")).toBe(true);
    expect(isStopMessage(" stop. ")).toBe(true);
    expect(isStopMessage("please don't stop")).toBe(false);
    expect(optedOut([{ body: "Stop" }, { body: "hello" }])).toBe(true);
    expect(optedOut([{ body: "START" }, { body: "STOP" }])).toBe(false);
    expect(optedOut([{ body: "thanks" }])).toBe(false);
    expect(optedOut([])).toBe(false);
  });

  it("signs and verifies like Twilio", () => {
    // Twilio's documented example.
    const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
    const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
    const token = "12345";
    expect(twilioSignature(url, params, token)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
    expect(verifyTwilioSignature(url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", token)).toBe(true);
    expect(verifyTwilioSignature(url, { ...params, Digits: "9" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", token)).toBe(false);
    expect(verifyTwilioSignature(url, params, "", token)).toBe(false);
    expect(verifyTwilioSignature(url, params, "x", undefined)).toBe(false);
  });
});
