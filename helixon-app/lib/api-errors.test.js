import { describe, expect, it } from "vitest";
import { responseErrorMessage, SIGNED_OUT_MESSAGE } from "./api-errors";

describe("responseErrorMessage", () => {
  it("prefers the server's own message", () => {
    expect(responseErrorMessage(400, { error: "Pick a job first." })).toBe("Pick a job first.");
  });
  it("says signed out for a 401, whatever the body", () => {
    expect(responseErrorMessage(401, { error: "Please sign in to continue." })).toBe(SIGNED_OUT_MESSAGE);
  });
  it("explains a server error with no body instead of 'Request failed'", () => {
    expect(responseErrorMessage(504, null)).toMatch(/our side \(error 504\)/);
  });
  it("ignores an empty error string", () => {
    expect(responseErrorMessage(429, { error: "  " })).toMatch(/Too many requests/);
  });
  it("has a plain fallback", () => {
    expect(responseErrorMessage(400, null)).toBe("That didn't work. Please try again.");
  });
});
