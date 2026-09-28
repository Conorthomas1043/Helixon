import { describe, it, expect } from "vitest";
import { EMPTY_ROLE_DRAFT, ROLE_TEMPLATES, JOB_TYPE_BY_ID, composeRoleText, guessJobType, mustHaveSuggestions, specChecklist } from "./roles.js";
import validateJob from "../../../lib/cv-analysis/validators/validateJob.js";

describe("composeRoleText", () => {
  it("writes a plain-English spec from the builder answers", () => {
    const text = composeRoleText({
      ...EMPTY_ROLE_DRAFT,
      jobType: "warehouse",
      title: "Warehouse Operative",
      location: "Leeds",
      payMin: "12.5",
      payMax: "13.20",
      payPeriod: "hour",
      patterns: ["Night shifts", "Weekends"],
      experience: "none",
      duties: "- Picking orders\nLoading vans",
      mustHaves: ["Right to work in the UK"],
    });
    expect(text).toContain("Job title: Warehouse Operative");
    expect(text).toContain("Pay: £12.50-£13.20 per hour");
    expect(text).toContain("Hours: Night shifts, Weekends");
    expect(text).toContain("No previous experience needed");
    expect(text).toContain("- Picking orders\n- Loading vans");
    expect(text).toContain("Essential requirements:\n- Right to work in the UK");
  });

  it("is empty for an empty draft", () => {
    expect(composeRoleText(EMPTY_ROLE_DRAFT)).toBe("");
  });
});

describe("specChecklist", () => {
  it("recognises what a frontline advert covers", () => {
    const done = Object.fromEntries(
      specChecklist("Kitchen Porter\nCity centre restaurant, £11.75/hr\nEvenings and weekends\nYou will wash pots and help with prep.\nMust have right to work.").map((i) => [i.key, i.done])
    );
    expect(done).toMatchObject({ title: true, pay: true, hours: true, duties: true, requirements: true });
  });

  it("marks everything missing for empty text", () => {
    expect(specChecklist("").every((i) => !i.done)).toBe(true);
  });
});

describe("guessJobType / suggestions", () => {
  it("guesses the kind of work from an advert", () => {
    expect(guessJobType("We need a Care Assistant for our care home")).toBe("care");
    expect(guessJobType("Multi-drop delivery driver wanted")).toBe("driving");
    expect(guessJobType("Senior Software Engineer")).toBe("professional");
    expect(guessJobType("")).toBe("");
  });

  it("always suggests right to work, and never a physical requirement", () => {
    for (const type of Object.keys(JOB_TYPE_BY_ID)) {
      const s = mustHaveSuggestions(type);
      expect(s).toContain("Right to work in the UK");
      expect(s.some((x) => /\blift(ing)?\b|physically|\bfit\b|health condition/i.test(x))).toBe(false);
    }
  });
});

describe("templates", () => {
  it("cover every kind of work and each has a known type", () => {
    const types = new Set(ROLE_TEMPLATES.map((t) => t.type));
    for (const t of ROLE_TEMPLATES) expect(JOB_TYPE_BY_ID[t.type]).toBeTruthy();
    expect(types.size).toBeGreaterThanOrEqual(10);
  });

  it("have unique ids and are long enough to analyse", () => {
    expect(new Set(ROLE_TEMPLATES.map((t) => t.id)).size).toBe(ROLE_TEMPLATES.length);
    for (const t of ROLE_TEMPLATES) expect(t.text.trim().length).toBeGreaterThanOrEqual(50);
  });

  it("never include a physical or protected requirement", () => {
    for (const t of ROLE_TEMPLATES) {
      const job = validateJob({ knockout_requirements: [{ field: "requirement", value: t.text }] });
      expect(job.knockout_requirements, t.id).toHaveLength(1);
    }
  });
});
