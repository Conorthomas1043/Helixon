import { describe, expect, it } from "vitest";
import { TOKEN_RE, cleanSignature, cleanSignatureRequest, documentHash, newToken, offerLetterText, termsOfBusinessText } from "./signatures";

describe("signature requests", () => {
  it("validates a new request", () => {
    expect(cleanSignatureRequest({ kind: "terms", title: "Terms", body: "Text\r\nmore", signerName: "Sam", signerEmail: "sam@acme.com" })).toEqual({
      kind: "terms",
      title: "Terms",
      body: "Text\nmore",
      signerName: "Sam",
      signerEmail: "sam@acme.com",
      expiresInDays: 30,
    });
    expect(cleanSignatureRequest({ title: "x", body: "", signerName: "Sam" }).error).toBeTruthy();
    expect(cleanSignatureRequest({ title: "x", body: "y", signerName: "" }).error).toBeTruthy();
    expect(cleanSignatureRequest({ title: "x", body: "y", signerName: "S", signerEmail: "nope" }).error).toBeTruthy();
    expect(cleanSignatureRequest({ kind: "weird", title: "x", body: "y", signerName: "S" }).kind).toBe("other");
  });

  it("needs a typed name and agreement to sign", () => {
    expect(cleanSignature({ name: "Sam Smith", agree: true })).toEqual({ name: "Sam Smith" });
    expect(cleanSignature({ name: "Sam Smith" }).error).toBeTruthy();
    expect(cleanSignature({ name: "", agree: true }).error).toBeTruthy();
    expect(cleanSignature({ decline: true, reason: "Fee too high" })).toEqual({ decline: true, reason: "Fee too high" });
  });

  it("hashes exactly what was signed", () => {
    expect(documentHash("T", "B")).toBe(documentHash("T", "B"));
    expect(documentHash("T", "B")).not.toBe(documentHash("T", "B "));
    expect(documentHash("T", "B")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("makes unguessable tokens", () => {
    const t = newToken();
    expect(t).toMatch(TOKEN_RE);
    expect(newToken()).not.toBe(t);
  });
});

describe("templates", () => {
  it("fills terms of business from the client's terms", () => {
    const text = termsOfBusinessText({ agencyName: "Acme Recruit", clientName: "Beta Ltd", feePercent: 18, paymentTermsDays: 14, rebateDays: 90, termsNotes: "Exclusive for 4 weeks." });
    expect(text).toContain("between Acme Recruit");
    expect(text).toContain("18% of the candidate's first-year base salary");
    expect(text).toContain("within 14 days");
    expect(text).toContain("within 90 days of starting");
    expect(text).toContain("Exclusive for 4 weeks.");
  });

  it("writes a permanent offer and a contract assignment", () => {
    expect(offerLetterText({ candidateName: "Ana", jobTitle: "Dev", clientName: "Beta", salary: 50000, startDate: "2026-11-02" })).toContain("Salary: £50,000 per year");
    const c = offerLetterText({ kind: "contract", candidateName: "Ana", jobTitle: "Dev", payRate: 400, rateUnit: "day", startDate: "2026-11-02" });
    expect(c).toContain("Pay rate: £400 per day");
    expect(c).toContain("Start date: 2 November 2026");
  });
});
