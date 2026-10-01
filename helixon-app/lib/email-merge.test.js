import { describe, expect, it } from "vitest";
import { mergeContext, renderTemplate } from "./email-merge";

const ctx = mergeContext({
  candidate: { full_name: "Ana Ruiz", current_title: "Data Engineer" },
  job: { title: "Senior Data Engineer", client: "Acme", salary_range: "£70k" },
  recruiter: { first_name: "Sam", last_name: "Lee" },
  agencyName: "Talent Co",
});

describe("renderTemplate", () => {
  it("fills known fields", () => {
    const r = renderTemplate("Hi {{candidate.first_name}}, the {{ job.title }} role at {{job.client}} pays {{job.salary}}. - {{recruiter.name}}, {{agency.name}}", ctx);
    expect(r.text).toBe("Hi Ana, the Senior Data Engineer role at Acme pays £70k. - Sam Lee, Talent Co");
    expect(r.missing).toEqual([]);
  });

  it("reports empty and unknown fields", () => {
    const r = renderTemplate("Hi {{contact.first_name}} {{candiate.name}}", ctx);
    expect(r.text).toBe("Hi  {{candiate.name}}");
    expect(r.missing).toEqual(["contact.first_name", "candiate.name"]);
  });

  it("is case-insensitive on field names", () => {
    expect(renderTemplate("{{Candidate.First_Name}}", ctx).text).toBe("Ana");
  });
});
