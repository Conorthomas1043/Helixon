import { describe, expect, it } from "vitest";
import { buildCandidateSearchFilter, cleanSearchTerm, likePattern, matchingRecruiterIds, quoted } from "./candidate-search";

describe("candidate search", () => {
  it("quotes values so filter syntax is literal", () => {
    expect(quoted('a,b.c"d\\e')).toBe('"a,b.c\\"d\\\\e"');
  });

  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
  });

  it("caps and trims the term", () => {
    expect(cleanSearchTerm("  ana  ")).toBe("ana");
    expect(cleanSearchTerm("x".repeat(500))).toHaveLength(100);
    expect(cleanSearchTerm(null)).toBe("");
  });

  it("matches person columns, skills, jobs and recruiters", () => {
    const filter = buildCandidateSearchFilter("react", { jobIds: ["j1"], recruiterIds: ["user_1"] });
    expect(filter).toContain('full_name.ilike."%react%"');
    expect(filter).toContain('current_company.ilike."%react%"');
    expect(filter).toContain('extracted->>skills.ilike."%react%"');
    expect(filter).toContain('job_id.in.("j1")');
    expect(filter).toContain('recruiter_id.in.("user_1")');
  });

  it("leaves out job/recruiter clauses when nothing matched", () => {
    const filter = buildCandidateSearchFilter("x");
    expect(filter).not.toContain("job_id");
    expect(filter).not.toContain("recruiter_id");
  });

  it("can't smuggle extra filters through the term", () => {
    const filter = buildCandidateSearchFilter('a",stage.neq.x');
    expect(filter).toContain('full_name.ilike."%a\\",stage.neq.x%"');
  });

  it("finds recruiters by name", () => {
    const team = [{ id: "u1", name: "Sam Patel" }, { id: "u2", name: "Jo Smith" }, { id: "u3", name: null }];
    expect(matchingRecruiterIds(team, "pat")).toEqual(["u1"]);
  });
});
