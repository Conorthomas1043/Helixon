import { describe, expect, it } from "vitest";
import { guessMapping, mapRow } from "./import-mapping";
import { parseCsv } from "./csv";

describe("guessMapping", () => {
  it("maps a Bullhorn-style candidate export", () => {
    const headers = ["First Name", "Last Name", "Email", "Mobile", "Occupation", "Company Name", "Skill Set", "Date Last Modified"];
    expect(guessMapping(headers, "candidates")).toEqual({
      first_name: 0, last_name: 1, email: 2, phone: 3, current_title: 4, current_company: 5, skills: 6, last_activity_at: 7,
    });
  });

  it("uses each column once", () => {
    const m = guessMapping(["Company", "Name", "Email"], "clients");
    expect(m).toEqual({ name: 0, contact_name: 1, contact_email: 2 });
  });
});

describe("mapRow", () => {
  it("builds a candidate from first/last name and splits skills", () => {
    const { record, errors } = mapRow(["Ana", "Ruiz", "ANA@x.com", "07700", "Dev", "Acme", "Go; SQL, Python", "03/02/2025"], guessMapping(["First Name", "Last Name", "Email", "Mobile", "Occupation", "Company Name", "Skills", "Last Contacted"], "candidates"), "candidates");
    expect(errors).toEqual([]);
    expect(record).toMatchObject({ full_name: "Ana Ruiz", email: "ana@x.com", skills: ["Go", "SQL", "Python"], last_activity_at: "2025-02-03T00:00:00.000Z" });
  });

  it("flags rows without a name and bad emails", () => {
    expect(mapRow(["", "bad"], { full_name: 0, email: 1 }, "candidates").errors).toEqual(["No name", "Invalid email"]);
  });

  it("parses client fees and normalises sources", () => {
    const { record, errors } = mapRow(["Acme", "18%", "30", "jo@acme.com"], { name: 0, fee_percent: 1, payment_terms_days: 2, contact_email: 3 }, "clients");
    expect(errors).toEqual([]);
    expect(record).toMatchObject({ name: "Acme", fee_percent: 18, payment_terms_days: 30, contact_name: "jo", contact_email: "jo@acme.com" });
    expect(mapRow(["Acme", "150"], { name: 0, fee_percent: 1 }, "clients").errors).toContain("Fee isn't a percentage");
    expect(mapRow(["X", "LinkedIn Recruiter"], { full_name: 0, source: 1 }, "candidates").record.source).toBe("linkedin");
  });

  it("maps job status", () => {
    expect(mapRow(["Dev", "Filled"], { title: 0, status: 1 }, "jobs").record.status).toBe("closed");
    expect(mapRow(["Dev", "Active"], { title: 0, status: 1 }, "jobs").record.status).toBe("open");
  });

  it("works with the shared CSV parser", () => {
    const rows = parseCsv('Name,Email\n"Ruiz, Ana",ana@x.com\n');
    expect(mapRow(rows[1], guessMapping(rows[0], "candidates"), "candidates").record.full_name).toBe("Ruiz, Ana");
  });
});
