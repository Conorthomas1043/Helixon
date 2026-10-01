import { describe, expect, it } from "vitest";
import { duplicateFilter, linkedInHandle, normaliseEmail, pickExistingPerson } from "./candidate-duplicates";

describe("identifiers", () => {
  it("normalises emails", () => {
    expect(normaliseEmail("  Ana.Ruiz@Example.COM ")).toBe("ana.ruiz@example.com");
    expect(normaliseEmail("not an email")).toBeNull();
    expect(normaliseEmail(null)).toBeNull();
  });

  it("pulls the LinkedIn handle out of any URL form", () => {
    expect(linkedInHandle("https://uk.linkedin.com/in/Ana-Ruiz/")).toBe("ana-ruiz");
    expect(linkedInHandle("linkedin.com/in/ana-ruiz?trk=x")).toBe("ana-ruiz");
    expect(linkedInHandle("https://github.com/ana")).toBeNull();
  });
});

describe("duplicateFilter", () => {
  it("is null with nothing to match on", () => {
    expect(duplicateFilter({ name: "Ana Ruiz" })).toBeNull();
  });

  it("matches email exactly and LinkedIn by handle, quoted", () => {
    const f = duplicateFilter({ email: "ana_r@example.com", linkedin: "linkedin.com/in/ana-ruiz" });
    expect(f).toBe('email.ilike."ana\\\\_r@example.com",linkedin.ilike."%linkedin.com/in/ana-ruiz%"');
  });
});

describe("pickExistingPerson", () => {
  const ex = { email: "ana@example.com", linkedin: "https://www.linkedin.com/in/ana-ruiz" };

  it("returns the person's root row", () => {
    const rows = [
      { id: "root", pooled_from_id: null, email: "ANA@example.com", created_at: "2026-01-01" },
      { id: "child", pooled_from_id: "root", email: "ana@example.com", created_at: "2026-02-01" },
    ];
    expect(pickExistingPerson(rows, ex)).toMatchObject({ rootId: "root", matchedOn: "email" });
  });

  it("re-checks LIKE matches and ignores near misses", () => {
    const rows = [{ id: "x", linkedin: "linkedin.com/in/ana-ruiz-2", created_at: "2026-01-01" }];
    expect(pickExistingPerson(rows, ex)).toBeNull();
  });

  it("takes the oldest person when several match, and says what matched", () => {
    const rows = [
      { id: "a", email: "ana@example.com", created_at: "2026-01-01" },
      { id: "b", email: "ana@example.com", linkedin: "linkedin.com/in/ana-ruiz", created_at: "2026-03-01" },
    ];
    expect(pickExistingPerson(rows, ex).rootId).toBe("a");
    expect(pickExistingPerson([rows[1]], ex).matchedOn).toBe("email and LinkedIn");
  });
});
