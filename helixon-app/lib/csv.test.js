import { describe, expect, it } from "vitest";
import { parseCsv, mapColumns, phoneKey, contactsFromCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas/newlines and CRLF", () => {
    const rows = parseCsv('﻿Name,Notes\r\n"Smith, Jo","said ""call back""\nlater"\r\n');
    expect(rows).toEqual([
      ["Name", "Notes"],
      ["Smith, Jo", 'said "call back"\nlater'],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n,\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("mapColumns", () => {
  it("maps common header names", () => {
    const { mapping, hasHeader } = mapColumns(["Company Name", "First Name", "Surname", "Mobile Number", "E-mail"]);
    expect(hasHeader).toBe(true);
    expect(mapping).toMatchObject({ company: 0, first_name: 1, last_name: 2, phone: 3, email: 4 });
  });

  it("falls back to name, company, phone when there is no header", () => {
    expect(mapColumns(["Jo Smith", "Acme", "07700 900123"])).toEqual({
      mapping: { contact_name: 0, company: 1, phone: 2 },
      hasHeader: false,
    });
  });
});

describe("phoneKey", () => {
  it("treats UK formats as the same number", () => {
    expect(phoneKey("07700 900123")).toBe(phoneKey("+44 7700 900123"));
    expect(phoneKey("n/a")).toBe("");
  });
});

describe("contactsFromCsv", () => {
  it("builds contacts, skips rows with no phone and de-duplicates", () => {
    const csv = [
      "First Name,Last Name,Company,Phone",
      "Jo,Smith,Acme,07700 900123",
      "Sam,Lee,Beta,",
      "Jo,Smith,Acme,+44 7700 900123",
      "Ali,Khan,Gamma,020 7946 0000",
    ].join("\n");
    const result = contactsFromCsv(csv);
    expect(result.contacts).toEqual([
      { contact_name: "Jo Smith", company: "Acme", phone: "07700 900123", email: "", notes: "" },
      { contact_name: "Ali Khan", company: "Gamma", phone: "020 7946 0000", email: "", notes: "" },
    ]);
    expect(result.skipped).toBe(1);
    expect(result.duplicates).toBe(1);
  });
});
