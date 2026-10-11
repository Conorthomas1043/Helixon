import { describe, expect, it } from "vitest";
import { isLive, jobPostingJsonLd, jobsFeedXml, slugify, sourceFromParam, toPublicJob, validSlug } from "./careers";

describe("slugs", () => {
  it("slugifies agency names", () => {
    expect(slugify("Acme Talent & Search Ltd.")).toBe("acme-talent-and-search-ltd");
    expect(slugify("  Café Recruiters ")).toBe("cafe-recruiters");
  });
  it("validates", () => {
    expect(validSlug("acme-talent")).toBe(true);
    expect(validSlug("a")).toBe(false);
    expect(validSlug("-acme")).toBe(false);
    expect(validSlug("api")).toBe(false);
    expect(validSlug("Acme")).toBe(false);
  });
});

describe("sourceFromParam", () => {
  it("maps known channels and keeps the detail", () => {
    expect(sourceFromParam("indeed")).toEqual({ source: "job_board", detail: "indeed" });
    expect(sourceFromParam("LinkedIn")).toEqual({ source: "linkedin", detail: "linkedin" });
    expect(sourceFromParam("mystery<script>")).toEqual({ source: "other", detail: "mysteryscript" });
    expect(sourceFromParam("")).toEqual({ source: "careers_page", detail: null });
  });
});

describe("public jobs", () => {
  const row = { id: "j1", title: "Internal: Dev for Acme", public_title: "Senior Developer", client: "Acme", hide_client: true, show_salary: false, salary_range: "£70k", location: "Leeds", employment_type: "Permanent", job_text: "SECRET NOTES", public_description: "Great role", published: true, status: "open", published_at: "2026-10-01T00:00:00Z" };

  it("hides internal fields", () => {
    const p = toPublicJob(row);
    expect(p).toMatchObject({ title: "Senior Developer", client: null, salary: null, description: "Great role" });
    expect(JSON.stringify(p)).not.toContain("SECRET");
  });

  it("is live only when published, open and the page is on", () => {
    const agency = { careers_enabled: true, careers_slug: "acme" };
    expect(isLive(row, agency)).toBe(true);
    expect(isLive({ ...row, status: "closed" }, agency)).toBe(false);
    expect(isLive(row, { ...agency, careers_enabled: false })).toBe(false);
    expect(isLive(row, { ...agency, suspended_at: "x" })).toBe(false);
  });

  it("builds JSON-LD and an XML feed", () => {
    const p = toPublicJob(row);
    const agency = { name: "Talent Co", careers_slug: "talent-co" };
    const ld = jobPostingJsonLd(p, agency, "https://x/jobs/talent-co/j1");
    expect(ld).toMatchObject({ "@type": "JobPosting", title: "Senior Developer", employmentType: "FULL_TIME", hiringOrganization: { name: "Talent Co" } });
    const xml = jobsFeedXml([{ ...p, description: "a ]]> b" }], agency, "https://x");
    expect(xml).toContain("<referencenumber>j1</referencenumber>");
    expect(xml).toContain("https://x/jobs/talent-co/j1?src=indeed");
    expect(xml).toContain("a ]]]]><![CDATA[> b");
  });
});
